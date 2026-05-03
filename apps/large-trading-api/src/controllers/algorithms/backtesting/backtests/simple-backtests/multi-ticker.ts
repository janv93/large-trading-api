import { Algorithm, AlgorithmConfigMulti, Kline, MultiBenchmark } from '@shared';
import Base from '../../../../../base';
import Backtester from '../../backtester/backtester';
import MeanReversion from '../investing/mean-reversion';
import deepmerge from 'deepmerge';

export default class MultiTicker extends Base {
  private backtest = new Backtester();
  private algos: Partial<Record<Algorithm, { setSignals: (klines: Kline[], algorithm: Algorithm, params: any) => Kline[] }>> = {
    [Algorithm.MeanReversion]: new MeanReversion(),
  };

  public async handleAlgo(tickers: Kline[][], params: Record<string, AlgorithmConfigMulti | Algorithm>): Promise<Kline[][]> {
    const algorithm: Algorithm = params.algorithm as Algorithm;

    const multiConfigs = Object.entries(params).filter(([key]) => key !== 'algorithm') as [string, AlgorithmConfigMulti][];
    const combinations = this.generateCombinations(multiConfigs);
    const benchmarks: MultiBenchmark[] = [];

    for (const combo of combinations) {
      console.log(combo);
      const tickersWithBacktest = this.runAlgo(tickers, algorithm, combo);
      const tickersProfits: number[] = tickersWithBacktest.map(t => this.calcProfitPerAmount(t, algorithm)).filter((t): t is number => t !== undefined);
      const average = tickersProfits.reduce((a, c) => a + c, 0) / tickersProfits.length;

      benchmarks.push({
        tickers: tickersWithBacktest,
        averageProfit: average,
        score: this.calcAverageLogarithmicProfit(tickersProfits),
        params: combo
      });
    }

    benchmarks.sort((a, b) => a.score - b.score);

    console.log();
    // log top 10 performers
    benchmarks.slice(-10).forEach(b => {
      const paramStr = Object.entries(b.params ?? {}).map(([k, v]) => `${k}=${v}`).join(' ');
      console.log(paramStr, Math.round(b.averageProfit), Math.round(b.score));
    });
    console.log();

    // log stats of best performer
    benchmarks.at(-1)?.tickers.forEach((t: Kline[]) => {
      const profit = this.getLastProfit(t, algorithm);
      console.log(t.length, t[0].symbol, profit);
    });

    return benchmarks.at(-1)?.tickers ?? [];
  }

  private generateCombinations(configs: [string, AlgorithmConfigMulti][]): Record<string, number>[] {
    const ranges = configs.map(([key, config]) => {
      const values: number[] = [];
      const step = config.step ?? 1;
      for (let v = config.min; v <= config.max + step * 0.5; v += step) {
        values.push(Math.round(v * 1e10) / 1e10);
      }
      return { key, values };
    });

    return ranges.reduce<Record<string, number>[]>((combos, { key, values }) => {
      return combos.flatMap(combo => values.map(v => ({ ...combo, [key]: v })));
    }, [{}]);
  }

  private runAlgo(tickers: Kline[][], algorithm: Algorithm, params: Record<string, number>): Kline[][] {
    const algo = this.algos[algorithm];
    if (!algo) throw new Error(`Algorithm ${algorithm} is not supported in multi-ticker mode`);

    const clonedTickers = deepmerge({}, tickers);
    return clonedTickers.map((currentTicker: Kline[]) => {
      currentTicker.forEach((kline: Kline) => { kline.algorithms[algorithm] = { signals: [] }; });
      const klinesWithSignals = algo.setSignals(currentTicker, algorithm, params);
      return this.backtest.calcBacktestPerformance(klinesWithSignals, algorithm, 0);
    });
  }
}