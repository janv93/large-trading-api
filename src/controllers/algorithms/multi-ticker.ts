import { Kline, MultiBenchmark } from '../../interfaces';
import Base from '../base';
import Backtest from './backtest';
import MeanReversion from './investing/mean-reversion';
import deepmerge from 'deepmerge';

export default class MultiTicker extends Base {
  private backtest = new Backtest();
  private meanReversion = new MeanReversion();

  public setSignals(klines: Kline[][], algorithm: string): any {
    switch (algorithm) {
      case 'meanReversion': this.setSignalsMeanReversion(klines); return 'done';
      default: return 'invalid algorithm';
    }

    // todo algo: all time high 20% above old -> scale into short
    // only set signal if n klines before now
    // then: only set signal if rsi high
  }

  private setSignalsMeanReversion(tickers: Kline[][]): Kline[][] {
    let threshold = 0.1;
    const thresholdMax = 0.2;
    const thresholdStep = 0.05;
    const exitMultiplierMin = 0.1
    let exitMultiplier = exitMultiplierMin;
    const exitMultiplierMax = 0.3;
    const exitMultiplierStep = 0.05;

    let benchmarks: MultiBenchmark[] = [];

    // run all combinations of params
    while (threshold <= thresholdMax) {
      exitMultiplier = exitMultiplierMin;

      while (exitMultiplier <= exitMultiplierMax) {
        console.log(threshold, exitMultiplier)
        const tickersWithBacktest = this.runMeanReversion(tickers, threshold, exitMultiplier);
        const tickersProfits: number[] = tickersWithBacktest.map(t => this.calcProfitPerAmount(t)).filter((t): t is number => t !== undefined);
        const average = tickersProfits.reduce((a, c) => a + c, 0) / tickersProfits.length;

        benchmarks.push({
          tickers: tickersWithBacktest,
          averageProfit: average,
          score: this.calcAverageLogarithmicProfit(tickersProfits),
          params: {
            threshold,
            exitMultiplier
          }
        });

        exitMultiplier += exitMultiplierStep;
      }

      threshold += thresholdStep;
    }

    benchmarks.sort((a, b) => a.score - b.score);

    console.log();
    // log top 10 performers
    benchmarks.slice(-10).forEach(b => {
      console.log(b.params?.threshold, b.params?.exitMultiplier, Math.round(b.averageProfit), Math.round(b.score));
    });
    console.log();

    // log stats of best performer
    benchmarks.at(-1)?.tickers.forEach((t: Kline[]) => {
      const profit = this.getLastProfit(t);
      console.log(t.length, t[0].symbol, profit);
    });

    return benchmarks.at(-1)?.tickers ?? [];
  }

  private runMeanReversion(tickers: Kline[][], threshold: number, exitMultiplier: number): Kline[][] {
    const clonedTickers = deepmerge({}, tickers);

    return clonedTickers.map((currentTicker: Kline[]) => {
      const klinesWithSignals = this.meanReversion.setSignals(currentTicker, threshold, exitMultiplier);
      const klinesWithBacktest = this.backtest.calcBacktestPerformance(klinesWithSignals, 0, true);
      return klinesWithBacktest;
    });
  }
}