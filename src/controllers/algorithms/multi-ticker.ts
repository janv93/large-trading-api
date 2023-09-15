import { Kline, MultiBenchmark } from '../../interfaces';
import Base from '../base';
import Backtest from './backtest';
import Ema from './ema';
import Martingale from './investing/martingale';

export default class MultiTicker extends Base {
  private ema = new Ema();
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

  private setSignalsMartingale(klines: Kline[][]): Kline[][] {
    let threshold = 0.05;
    const thresholdMax = 0.5;
    const thresholdStep = 0.05;
    let exitMultiplier = 1;
    const exitMultiplierMax = 5;
    const exitMultiplierStep = 0.5;

    let benchmarks: MultiBenchmark[] = [];

    // run all combinations of params
    while (threshold <= thresholdMax) {
      exitMultiplier = 1;

      while (exitMultiplier <= exitMultiplierMax) {
        const tickers = this.runMartingale(klines, threshold, exitMultiplier);
        const tickersProfits: number[] = tickers.map(t => this.getLastProfit(t)).filter((t): t is number => t !== undefined);
        const average = tickersProfits.reduce((a, v) => a + v) / tickersProfits.length;

        benchmarks.push({
          klines: tickers,
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

    benchmarks.sort((a, b) => a.averageProfit - b.averageProfit);

    benchmarks.slice(-10).forEach(b => {
      console.log(b.params?.threshold, b.params?.exitMultiplier, Math.round(b.averageProfit), Math.round(b.score));
    });

    return benchmarks.at(-1)?.klines ?? [];
  }

  private runMartingale(klines: Kline[][], threshold: number, exitMultiplier: number): Kline[][] {
    return klines.map((currentKlines: Kline[]) => {
      const klinesWithSignals = this.martingale.setSignals(currentKlines, threshold, exitMultiplier);
      const klinesWithBacktest = this.backtest.calcBacktestPerformance(klinesWithSignals, 0, true);
      return klinesWithBacktest;
    });
  }
}