import { Algorithm, BacktestData, Kline, Signal } from '../../../interfaces';
import Base from '../../base';

export default class Backtester extends Base {
  /**
   * @param klines the klines returned from /klinesWithAlgorithm
   * @param commission commission of exchange, e.g. 0.04
   * @param flowingProfit when true, calculates profit for every kline (false calculates only at signals)
   * @returns the klines with profits
   */
  public calcBacktestPerformance(klines: Kline[], algorithm: Algorithm, commission: number, flowingProfit: boolean): Kline[] {
    let percentProfit = 0;
    let lastSignalKline: Kline;
    let currentAmount = 0;

    klines.forEach((kline: Kline, i: number) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      backtest.openAmount = currentAmount;

      if (lastSignalKline) {
        if (flowingProfit) {  // recalculate profit every kline
          const priceChangeInPercent = this.calcPriceChangeInPercent(algorithm, kline, lastSignalKline, klines[i - 1]);
          percentProfit += priceChangeInPercent * currentAmount;
        } else {  // recalculate profit only on signal
          if (backtest.signal && lastSignalKline.algorithms[algorithm]!.signal !== Signal.Close) {  // e.g. current signal = close, last signal = buy
            const priceChangeInPercent = this.calcPriceChangeInPercent(algorithm, kline, lastSignalKline);
            percentProfit += priceChangeInPercent * currentAmount;
          }
        }
      }

      if (kline.algorithms[algorithm]!.signal) {
        percentProfit -= this.calcCommission(kline, algorithm, commission, currentAmount);
        currentAmount = this.calcAmount(kline, algorithm, currentAmount);
        lastSignalKline = kline;
      }

      backtest.percentProfit = percentProfit;
    });

    return klines;
  }

  /**
   * calculate price change in percent
   * 1. if flowing profit, calc between current and last price, relative to price at last signal
   * 2. if no flowing profit, calc between current and price at last signal
   * @param kline - current kline (i)
   * @param lastSignalKline - last kline with signal (i - n)
   * @param lastKline - last kline (i - 1)
   */
  private calcPriceChangeInPercent(algorithm: Algorithm, currentKline: Kline, lastSignalKline: Kline, lastKline?: Kline): number {
    const diff = this.signalOrClosePrice(currentKline, algorithm) - this.signalOrClosePrice(lastKline ?? lastSignalKline, algorithm);
    return diff / this.signalOrClosePrice(lastSignalKline, algorithm) * 100;
  }

  private calcCommission(kline: Kline, algorithm: Algorithm, baseCommission: number, currentAmount: number): number {
    switch (kline.algorithms[algorithm]!.signal) {
      case Signal.Close: return baseCommission * Math.abs(currentAmount);
      case Signal.Buy:
      case Signal.Sell: return baseCommission * (kline.algorithms[algorithm]!.amount || 1);
      case Signal.CloseBuy:
      case Signal.CloseSell: return baseCommission * Math.abs(currentAmount) + baseCommission * (kline.algorithms[algorithm]!.amount || 1);
      default: return NaN;
    }
  }

  private calcAmount(kline: Kline, algorithm: Algorithm, currentAmount: number): number {
    const amount = kline.algorithms[algorithm]!.amount ?? 1;   // if amount is not present, use default amount of 1

    switch (kline.algorithms[algorithm]!.signal) {
      case Signal.Close: return 0;
      case Signal.CloseBuy: return amount;
      case Signal.CloseSell: return -amount;
      case Signal.Buy: return currentAmount + amount;
      case Signal.Sell: return currentAmount - amount;
      default: return NaN;
    }
  }
}