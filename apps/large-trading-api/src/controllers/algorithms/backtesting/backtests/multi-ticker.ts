import { Algorithm, AlgorithmConfigMulti, Kline, MultiBenchmark } from '@shared';
import Base from '../../../../base';
import Backtester from '../backtester/backtester';
import deepmerge from 'deepmerge';
import { Worker, isMainThread, workerData, parentPort } from 'worker_threads';
import * as os from 'os';

// ── Worker thread entry point ────────────────────────────────────────────────
if (!isMainThread) {
  const { sharedBuffer, bufferLength, combos, algorithm, algoModulePath } = workerData;

  const bytes = new Uint8Array(sharedBuffer, 0, bufferLength);
  const tickers: Kline[][] = JSON.parse(Buffer.from(bytes).toString('utf-8'));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AlgoClass = require(algoModulePath).default;
  const algoInstance = new AlgoClass();
  const backtester = new Backtester();

  const results: MultiBenchmark[] = combos.map((combo: Record<string, number>) => {
    const clonedTickers: Kline[][] = deepmerge([], tickers);

    clonedTickers.forEach((currentTicker: Kline[]) => {
      currentTicker.forEach((kline: Kline) => { kline.algorithms[algorithm] = { signals: [] }; });
      algoInstance.setSignals(currentTicker, algorithm, combo);
      backtester.calcBacktestPerformance(currentTicker, algorithm, 0);
    });

    const profits: number[] = clonedTickers
      .map((t: Kline[]) => t.at(-1)?.algorithms[algorithm]?.percentProfit)
      .filter((t): t is number => t !== undefined);

    const averageProfit = profits.length > 0 ? profits.reduce((a, c) => a + c, 0) / profits.length : 0;
    const score = profits.reduce((a, c) => a + (Math.sign(c) * Math.log(Math.abs(c) + 1) ** 4), 0) / profits.length;

    return { averageProfit, score, params: combo };
  });

  parentPort!.postMessage(results);
}
// ────────────────────────────────────────────────────────────────────────────

export default class MultiTicker extends Base {
  private backtest = new Backtester();

  public async handleAlgo(tickers: Kline[][], params: Record<string, AlgorithmConfigMulti | Algorithm>, algoInstance: any): Promise<Kline[][]> {
    const algorithm: Algorithm = params.algorithm as Algorithm;

    const multiConfigs = Object.entries(params).filter(([key]) => key !== 'algorithm') as [string, AlgorithmConfigMulti][];
    const combinations = this.generateCombinations(multiConfigs);
    const benchmarks: MultiBenchmark[] = [];
    let bestTickers: Kline[][] = [];
    let bestScore = -Infinity;

    const algoModulePath = this.resolveAlgoModulePath(algoInstance);

    if (algoModulePath && combinations.length > 1) {
      const workerBenchmarks = await this.runWithWorkers(tickers, algorithm, combinations, algoModulePath);
      benchmarks.push(...workerBenchmarks);

      const best = workerBenchmarks.reduce((b, c) => c.score > b.score ? c : b, workerBenchmarks[0]);
      if (best?.params) {
        bestTickers = this.runAlgo(tickers, algorithm, best.params, algoInstance);
      }
    } else {
      for (const combo of combinations) {
        this.log(combo);
        const tickersWithBacktest: Kline[][] = this.runAlgo(tickers, algorithm, combo, algoInstance);
        const tickersProfits: number[] = tickersWithBacktest.map(t => this.getLastProfit(t, algorithm)).filter((t): t is number => t !== undefined);
        const average: number = tickersProfits.reduce((a, c) => a + c, 0) / tickersProfits.length;
        const score = this.calcAverageLogarithmicProfit(tickersProfits);

        benchmarks.push({ averageProfit: average, score, params: combo });

        if (score > bestScore) {
          bestScore = score;
          bestTickers = tickersWithBacktest;
        }
      }
    }

    benchmarks.sort((a, b) => a.score - b.score);

    this.log();

    // log top 10 performers
    benchmarks.slice(-10).forEach(b => {
      const paramStr: string = Object.entries(b.params ?? {}).map(([k, v]) => `${k}=${v}`).join(' ');
      this.log(paramStr, 'avgProfit:', Math.round(b.averageProfit * 10) / 10, 'score:', Math.round(b.score));
    });

    this.log();

    return bestTickers;
  }

  private async runWithWorkers(
    tickers: Kline[][],
    algorithm: Algorithm,
    combinations: Record<string, number>[],
    algoModulePath: string
  ): Promise<MultiBenchmark[]> {
    // Serialize tickers once into a SharedArrayBuffer that all workers read without copying
    const encoded = Buffer.from(JSON.stringify(tickers), 'utf-8');
    const sharedBuffer = new SharedArrayBuffer(encoded.byteLength);
    new Uint8Array(sharedBuffer).set(encoded);

    const numWorkers = Math.min(os.cpus().length, combinations.length);
    const batchSize = Math.ceil(combinations.length / numWorkers);
    const batches = Array.from({ length: numWorkers }, (_, i) =>
      combinations.slice(i * batchSize, (i + 1) * batchSize)
    ).filter(batch => batch.length > 0);

    const results = await Promise.all(batches.map(combos =>
      new Promise<MultiBenchmark[]>((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { sharedBuffer, bufferLength: encoded.byteLength, combos, algorithm, algoModulePath } });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', code => { if (code !== 0) reject(new Error(`Worker exited with code ${code}`)); });
      })
    ));

    return results.flat();
  }

  private resolveAlgoModulePath(algoInstance: any): string | undefined {
    const ctor = algoInstance?.constructor;
    if (!ctor) return undefined;

    return Object.keys(require.cache).find(
      key => require.cache[key]?.exports?.default === ctor
    );
  }

  private generateCombinations(configs: [string, AlgorithmConfigMulti][]): Record<string, number>[] {
    const ranges: { key: string; values: number[] }[] = configs.map(([key, config]) => {
      const values: number[] = [];
      const step: number = config.step ?? 1;

      for (let v = config.min; v <= config.max + step * 0.5; v += step) {
        values.push(Math.round(v * 1e10) / 1e10);
      }

      return { key, values };
    });

    return ranges.reduce<Record<string, number>[]>((combos, { key, values }) => {
      return combos.flatMap(combo => values.map(v => ({ ...combo, [key]: v })));
    }, [{}]);
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