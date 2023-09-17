import { Kline, MultiBenchmark } from '../../interfaces';
import Base from '../base';
import Backtest from './backtest';
import Martingale from './investing/martingale';
import deepmerge from 'deepmerge';

export default class MultiTicker extends Base {
  private backtest = new Backtest();
  private martingale = new Martingale();

  public setSignals(klines: Kline[][], algorithm: string): any {
    switch (algorithm) {
      case 'martingale': return this.setSignalsMartingale(klines);
    }

    // todo algo: all time high 20% above old -> scale into short
    // only set signal if n klines before now
    // then: only set signal if rsi high
  }

  private setSignalsMartingale(tickers: Kline[][]): Kline[][] {
    let threshold = 0.2;
    const thresholdMax = 0.5;
    const thresholdStep = 0.05;
    let exitMultiplier = 1;
    const exitMultiplierMax = 3;
    const exitMultiplierStep = 0.5;

    let benchmarks: MultiBenchmark[] = [];

    // run all combinations of params
    while (threshold <= thresholdMax) {
      exitMultiplier = 1;

      while (exitMultiplier <= exitMultiplierMax) {
        console.log(threshold, exitMultiplier)
        const tickersWithBacktest = this.runMartingale(tickers, threshold, exitMultiplier);
        const tickersProfits: number[] = tickersWithBacktest.map(t => this.getLastProfit(t)).filter((t): t is number => t !== undefined);
        const average = tickersProfits.reduce((a, v) => a + v) / tickersProfits.length;

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

    benchmarks.slice(-10).forEach(b => {
      console.log(b.params?.threshold, b.params?.exitMultiplier, Math.round(b.averageProfit), Math.round(b.score));
    });

    benchmarks.at(-1)?.tickers.forEach((t: Kline[]) => {
      const profit = this.getLastProfit(t);
      console.log(t.length, t[0].symbol, profit);
    });

    return benchmarks.at(-1)?.tickers ?? [];
  }

  private runMartingale(tickers: Kline[][], threshold: number, exitMultiplier: number): Kline[][] {
    const clonedTickers = deepmerge({}, tickers);

    return clonedTickers.map((currentTicker: Kline[]) => {
      const klinesWithSignals = this.martingale.setSignals(currentTicker, threshold, exitMultiplier);
      const klinesWithBacktest = this.backtest.calcBacktestPerformance(klinesWithSignals, 0, true);
      return klinesWithBacktest;
    });
  }
}