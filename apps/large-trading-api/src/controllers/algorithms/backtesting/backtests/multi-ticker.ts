import { Algorithm, AlgorithmConfigMulti, Kline, MultiBenchmark } from '@shared';
import Base from '../../../../base';
import { calcScore } from '../../../../utils';
import Backtester from '../backtester/backtester';
import deepmerge from 'deepmerge';
import { Worker, isMainThread, workerData, parentPort } from 'worker_threads';
import * as os from 'os';


// ── Worker thread entry point ────────────────────────────────────────────────
if (!isMainThread) {
  const { sharedBuffer, bufferLength, combos, algorithm, algoModulePath } = workerData;

  const bytes = new Uint8Array(sharedBuffer, 0, bufferLength);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AlgoClass = require(algoModulePath).default;
  const algoInstance = new AlgoClass();
  const backtester = new Backtester();
  algoInstance.silent = true;
  backtester.silent = true;

  const tickers: Kline[][] = JSON.parse(Buffer.from(bytes).toString('utf-8'));
  // Capture RSS here — after deserialization (the dominant allocation) and before
  // combos.map(), so GC has not had a chance to deflate the value yet.
  const peakRss = process.memoryUsage().rss;

  const results: MultiBenchmark[] = combos.map((combo: Record<string, number>) => {
    tickers.forEach((currentTicker: Kline[]) => {
      currentTicker.forEach((kline: Kline) => {
        kline.algorithms[algorithm] = { signals: [] };
        kline.indicators = undefined;
        kline.chart = undefined;
      });

      algoInstance.setSignals(currentTicker, algorithm, combo);
      backtester.calcBacktestPerformance(currentTicker, algorithm, 0);
    });

    const score: number = calcScore(tickers, algorithm);
    return { score, params: combo };
  });

  parentPort!.postMessage({ results, peakRss });
}
// ────────────────────────────────────────────────────────────────────────────

export default class MultiTicker extends Base {
  private backtest = new Backtester();

  public async handleAlgo(tickers: Kline[][], params: Record<string, AlgorithmConfigMulti | Algorithm>, algoInstance: any): Promise<Kline[][]> {
    const algorithm: Algorithm = params.algorithm as Algorithm;
    const multiConfigs = Object.entries(params).filter(([key]) => key !== 'algorithm') as [string, AlgorithmConfigMulti][];
    const benchmarks: MultiBenchmark[] = [];
    let bestTickers: Kline[][] = [];
    const algoModulePath = this.resolveAlgoModulePath(algoInstance);

    const total = multiConfigs.reduce((acc, [, config]) => acc * (Math.round((config.max - config.min) / (config.step ?? 1)) + 1), 1);
    const workerBenchmarks = await this.runWithWorkers(tickers, algorithm, this.generateCombinations(multiConfigs), algoModulePath!, total);
    benchmarks.push(...workerBenchmarks);

    const best = workerBenchmarks.reduce((b, c) => c.score > b.score ? c : b, workerBenchmarks[0]);
    if (best?.params) {
      bestTickers = this.runAlgo(tickers, algorithm, best.params, algoInstance);
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
    tickers: Kline[][],
    algorithm: Algorithm,
    combinations: Generator<Record<string, number>>,
    algoModulePath: string,
    total: number
  ): Promise<MultiBenchmark[]> {
    const encoded = Buffer.from(JSON.stringify(tickers), 'utf-8');
    const sharedBuffer = new SharedArrayBuffer(encoded.byteLength);
    new Uint8Array(sharedBuffer).set(encoded);

    const spawnWorker = (combos: Record<string, number>[]): Promise<{ results: MultiBenchmark[], peakRss: number }> =>
      new Promise((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { sharedBuffer, bufferLength: encoded.byteLength, combos, algorithm, algoModulePath } });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', code => { if (code !== 0) reject(new Error(`Worker exited with code ${code}`)); });
      });

    // Probe a single worker to measure its real RSS — all workers are identical so this is exact.
    const firstCombo = combinations.next();
    if (firstCombo.done) return [];
    const probe = await spawnWorker([firstCombo.value]);
    const memPerWorker = probe.peakRss;
    const allResults: MultiBenchmark[] = [...probe.results];
    let processed = probe.results.length;
    this.logProgress(processed / total * 100);

    while (true) {
      // Derive concurrency from current free memory — reserve 2 cores for MongoDB/OS.
      const maxWorkers = Math.max(1, Math.min(Math.max(1, os.cpus().length - 2), Math.floor(os.freemem() * 0.85 / memPerWorker)));
      const batches: Record<string, number>[][] = [];
      let exhausted = false;

      for (let i = 0; i < maxWorkers; i++) {
        const batch: Record<string, number>[] = [];

        const next = combinations.next();
        if (next.done) { exhausted = true; break; }
        batch.push(next.value);

        if (batch.length > 0) batches.push(batch);
        if (exhausted) break;
      }

      if (batches.length === 0) break;

      // Spawn this wave, await all — workers die afterwards and memory is freed.
      const results = await Promise.all(batches.map(combos => spawnWorker(combos)));

      allResults.push(...results.flatMap(r => r.results));
      processed += results.reduce((sum, r) => sum + r.results.length, 0);
      this.logProgress(processed / total * 100);
      if (exhausted) break;
    }

    return allResults;
  }

  private resolveAlgoModulePath(algoInstance: any): string | undefined {
    const ctor = algoInstance?.constructor;
    if (!ctor) return undefined;

    return Object.keys(require.cache).find(
      key => require.cache[key]?.exports?.default === ctor
    );
  }

  private *generateCombinations(configs: [string, AlgorithmConfigMulti][]): Generator<Record<string, number>> {
    const ranges = configs.map(([key, config]) => {
      const step = config.step ?? 1;
      const values: number[] = [];
      for (let v = config.min; v <= config.max + step * 0.5; v += step) {
        values.push(Math.round(v * 1e10) / 1e10);
      }
      return { key, values };
    });

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

  private runAlgo(tickers: Kline[][], algorithm: Algorithm, params: Record<string, number>, algoInstance: any): Kline[][] {
    const clonedTickers: Kline[][] = deepmerge([], tickers);

    return clonedTickers.map((currentTicker: Kline[]) => {
      currentTicker.forEach((kline: Kline) => { kline.algorithms[algorithm] = { signals: [] }; });
      algoInstance.setSignals(currentTicker, algorithm, params);
      return this.backtest.calcBacktestPerformance(currentTicker, algorithm, 0);
    });
  }
}
