import { Algorithm, Kline, MultiBenchmark } from '../../../../interfaces';
import Base from '../../../base';
import Backtester from '../backtester/backtester';
import MeanReversion from '../investing/mean-reversion';
import deepmerge from 'deepmerge';

export default class MultiTicker extends Base {
  private backtest = new Backtester();
  private meanReversion = new MeanReversion();

  public handleAlgo(tickers: Kline[][], algorithm: Algorithm): Kline[][] {
    tickers.forEach((klines: Kline[]) => {
      klines.forEach((kline: Kline) => {
        kline.algorithms[algorithm] = {};
      });
    });

    switch (algorithm) {
      case Algorithm.MeanReversion: tickers = this.setSignalsMeanReversionAutoParams(tickers, algorithm); break;
      default: tickers = [];
    }

    return tickers;
  }

  private setSignalsMeanReversionAutoParams(tickers: Kline[][], algorithm: Algorithm): Kline[][] {
    let threshold = 0.1;
    const thresholdMax = 0.2;
    const thresholdStep = 0.05;
    const profitBasedTrailingStopLossMin = 0.1
    let profitBasedTrailingStopLoss = profitBasedTrailingStopLossMin;
    const profitBasedTrailingStopLossMax = 0.3;
    const profitBasedTrailingStopLossStep = 0.05;

    let benchmarks: MultiBenchmark[] = [];

    // run all combinations of params
    while (threshold <= thresholdMax) {
      profitBasedTrailingStopLoss = profitBasedTrailingStopLossMin;

      while (profitBasedTrailingStopLoss <= profitBasedTrailingStopLossMax) {
        console.log(threshold, profitBasedTrailingStopLoss)
        const tickersWithBacktest = this.runMeanReversion(tickers, algorithm, threshold, profitBasedTrailingStopLoss);
        const tickersProfits: number[] = tickersWithBacktest.map(t => this.calcProfitPerAmount(t, algorithm)).filter((t): t is number => t !== undefined);
        const average = tickersProfits.reduce((a, c) => a + c, 0) / tickersProfits.length;

        benchmarks.push({
          tickers: tickersWithBacktest,
          averageProfit: average,
          score: this.calcAverageLogarithmicProfit(tickersProfits),
          params: {
            threshold,
            profitBasedTrailingStopLoss
          }
        });

        profitBasedTrailingStopLoss += profitBasedTrailingStopLossStep;
      }

      threshold += thresholdStep;
    }

    benchmarks.sort((a, b) => a.score - b.score);

    console.log();
    // log top 10 performers
    benchmarks.slice(-10).forEach(b => {
      console.log(b.params?.threshold, b.params?.profitBasedTrailingStopLoss, Math.round(b.averageProfit), Math.round(b.score));
    });
    console.log();

    // log stats of best performer
    benchmarks.at(-1)?.tickers.forEach((t: Kline[]) => {
      const profit = this.getLastProfit(t, algorithm);
      console.log(t.length, t[0].symbol, profit);
    });

    return benchmarks.at(-1)?.tickers ?? [];
  }

  private runMeanReversion(tickers: Kline[][], algorithm: Algorithm, threshold: number, profitBasedTrailingStopLoss: number): Kline[][] {
    const clonedTickers = deepmerge({}, tickers);

    return clonedTickers.map((currentTicker: Kline[]) => {
      const klinesWithSignals = this.meanReversion.setSignals(currentTicker, algorithm, threshold, profitBasedTrailingStopLoss);
      const klinesWithBacktest = this.backtest.calcBacktestPerformance(klinesWithSignals, algorithm, 0, true);
      return klinesWithBacktest;
    });
  }
}