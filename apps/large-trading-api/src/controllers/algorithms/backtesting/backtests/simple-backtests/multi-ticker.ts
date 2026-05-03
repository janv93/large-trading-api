import { Algorithm, AlgorithmConfigMulti, Kline, MultiBenchmark } from '@shared';
import Base from '../../../../../base';
import Backtester from '../../backtester/backtester';
import deepmerge from 'deepmerge';

export default class MultiTicker extends Base {
  private backtest = new Backtester();

  public async handleAlgo(tickers: Kline[][], params: Record<string, AlgorithmConfigMulti | Algorithm>, algoInstance: any): Promise<Kline[][]> {
    const algorithm: Algorithm = params.algorithm as Algorithm;

    const multiConfigs = Object.entries(params).filter(([key]) => key !== 'algorithm') as [string, AlgorithmConfigMulti][];
    const combinations = this.generateCombinations(multiConfigs);
    const benchmarks: MultiBenchmark[] = [];

    for (const combo of combinations) {
      console.log(combo);
      const tickersWithBacktest = this.runAlgo(tickers, algorithm, combo, algoInstance);
      const tickersProfits: number[] = tickersWithBacktest.map(t => this.getLastProfit(t, algorithm)).filter((t): t is number => t !== undefined);
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

  private runAlgo(tickers: Kline[][], algorithm: Algorithm, params: Record<string, number>, algoInstance: any): Kline[][] {
    const clonedTickers = deepmerge([], tickers);
    return clonedTickers.map((currentTicker: Kline[]) => {
      currentTicker.forEach((kline: Kline) => { kline.algorithms[algorithm] = { signals: [] }; });
      const klinesWithSignals = algoInstance.setSignals(currentTicker, algorithm, params);
      return this.backtest.calcBacktestPerformance(klinesWithSignals, algorithm, 0);
    });
  }
}