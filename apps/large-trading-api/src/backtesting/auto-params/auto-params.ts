import { StrategyConfigMulti, BacktesterState, Bar, MultiBenchmark, countBars } from '@shared';
import Base from '../../base';
import Backtester from '../backtester/backtester';
import deepmerge from 'deepmerge';
import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';

type ParamRange = { key: string, values: number[] };

export default class AutoParams extends Base {
  private backtest = new Backtester();
  private readonly maxParallelWorkers = Math.max(1, os.cpus().length - 2); // reserve 2 cores for MongoDB/OS

  /** every combo walks all bars twice, once for the signals and once for the backtest, plus a final pass with the best params */
  public countSteps(tickers: Bar[][], config: Record<string, StrategyConfigMulti>): number {
    const combos: number = this.buildRanges(config).reduce((count, range) => count * range.values.length, 1);
    return (combos + 1) * countBars(tickers) * 2;
  }

  public async handleStrategy(tickers: Bar[][], config: Record<string, StrategyConfigMulti>, strategyInstance: any, onProgress: (steps: number) => void): Promise<Bar[][]> {
    const ranges: ParamRange[] = this.buildRanges(config);
    const benchmarks: MultiBenchmark[] = [];
    let bestTickers: Bar[][] = [];
    const strategyModulePath = this.resolveStrategyModulePath(strategyInstance);

    const workerBenchmarks = await this.runWithWorkers(tickers, ranges, strategyModulePath!, onProgress);
    benchmarks.push(...workerBenchmarks);

    const best = workerBenchmarks.reduce((b, c) => c.score > b.score ? c : b, workerBenchmarks[0]);
    if (best?.params) {
      bestTickers = await this.runStrategy(tickers, best.params, strategyInstance, onProgress);
    }

    benchmarks.sort((a, b) => a.score - b.score);
    this.log();

    benchmarks.slice(-10).forEach(b => {
      const paramStr: string = Object.entries(b.params ?? {}).map(([k, v]) => `${k}=${v}`).join(' ');
      this.log(paramStr, 'score:', Math.round(b.score * 1000) / 1000);
    });

    this.log();
    return bestTickers;
  }

  private async runWithWorkers(
    tickers: Bar[][],
    ranges: ParamRange[],
    strategyModulePath: string,
    onProgress: (steps: number) => void
  ): Promise<MultiBenchmark[]> {
    const combinations = this.generateCombinations(ranges);
    const encoded = Buffer.from(JSON.stringify(tickers), 'utf-8');
    const sharedBuffer = new SharedArrayBuffer(encoded.byteLength);
    new Uint8Array(sharedBuffer).set(encoded);

    const spawnWorker = (combo: Record<string, number>): Promise<{ result: MultiBenchmark, peakRss: number }> =>
      new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'worker.js'), { workerData: { sharedBuffer, bufferLength: encoded.byteLength, combo, strategyModulePath } });
        worker.on('message', (message: any) => {
          if (message.steps) onProgress(message.steps);
          if (message.result) resolve(message);
        });
        worker.on('error', reject);
        worker.on('exit', code => { if (code !== 0) reject(new Error(`Worker exited with code ${code}`)); });
      });

    // Probe a single worker to measure its real RSS — all workers are identical so this is exact.
    const firstCombo = combinations.next();
    if (firstCombo.done) return [];
    const probe = await spawnWorker(firstCombo.value);
    const memPerWorker = probe.peakRss;
    const allResults: MultiBenchmark[] = [probe.result];

    while (true) {
      // Derive concurrency from current free memory — reserve 2 cores for MongoDB/OS.
      const maxWorkers = Math.max(1, Math.min(this.maxParallelWorkers, Math.floor(os.freemem() * 0.85 / memPerWorker)));
      const batch: Record<string, number>[] = [];
      let exhausted = false;

      for (let i = 0; i < maxWorkers; i++) {
        const next = combinations.next();
        if (next.done) { exhausted = true; break; }
        batch.push(next.value);
      }

      if (batch.length === 0) break;

      // Spawn this wave, await all — workers die afterwards and memory is freed.
      const results = await Promise.all(batch.map(combo => spawnWorker(combo)));

      allResults.push(...results.map(r => r.result));
      if (exhausted) break;
    }

    return allResults;
  }

  private resolveStrategyModulePath(strategyInstance: any): string | undefined {
    const ctor = strategyInstance?.constructor;
    if (!ctor) return undefined;

    return Object.keys(require.cache).find(
      key => require.cache[key]?.exports?.default === ctor
    );
  }

  private buildRanges(configs: Record<string, StrategyConfigMulti>): ParamRange[] {
    return Object.entries(configs).map(([key, config]) => {
      const step = config.step ?? 1;
      const values: number[] = [];
      for (let v = config.min; v <= config.max + step * 0.5; v += step) {
        values.push(Math.round(v * 1e10) / 1e10);
      }
      return { key, values };
    });
  }

  private *generateCombinations(ranges: ParamRange[]): Generator<Record<string, number>> {
    if (ranges.length === 0) { yield {}; return; }

    const indices = new Array(ranges.length).fill(0);

    while (true) {
      const combo: Record<string, number> = {};
      for (let i = 0; i < ranges.length; i++) combo[ranges[i].key] = ranges[i].values[indices[i]];
      yield combo;

      let carry = 1;

      for (let i = ranges.length - 1; i >= 0 && carry; i--) {
        indices[i]++;
        if (indices[i] >= ranges[i].values.length) { indices[i] = 0; } else { carry = 0; }
      }

      if (carry) break;
    }
  }

  private async runStrategy(tickers: Bar[][], params: Record<string, number>, strategyInstance: any, onProgress: (steps: number) => void): Promise<Bar[][]> {
    const clonedTickers: Bar[][] = deepmerge([], tickers);
    const result: Bar[][] = [];

    for (const currentTicker of clonedTickers) {
      currentTicker.forEach((bar: Bar) => {
        bar.backtest = { signals: [] };
      });

      const signalState: any = {};
      const signalWindow: Bar[] = []; // grown by push, a slice per bar would copy the whole prefix and make the run quadratic
      for (let i = 0; i < currentTicker.length; i++) {
        signalWindow.push(currentTicker[i]);
        await strategyInstance.stepSetSignals(signalWindow, signalState, params);
        onProgress(1);
      }

      const backtesterState: BacktesterState = {};
      const backtesterWindow: Bar[] = [];
      for (let i = 0; i < currentTicker.length; i++) {
        backtesterWindow.push(currentTicker[i]);
        this.backtest.stepCalcBacktestPerformance(backtesterWindow, backtesterState, 0);
        onProgress(1);
      }

      result.push(currentTicker);
    }

    return result;
  }
}
