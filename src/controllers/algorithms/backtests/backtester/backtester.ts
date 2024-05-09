import { Algorithm, BacktestData, Kline, Signal } from '../../../../interfaces';
import Base from '../../../base';

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
          const priceChange = this.calcPriceChange(algorithm, kline, klines[i - 1]);
          percentProfit += priceChange * 100 * currentAmount;
          currentAmount = this.calcAmountFromPriceChange(currentAmount, priceChange);
        } else {  // recalculate profit only on signal
          if (backtest.signal && lastSignalKline.algorithms[algorithm]!.signal !== Signal.Close) {  // e.g. current signal = close, last signal = buy
            const priceChange = this.calcPriceChange(algorithm, kline, lastSignalKline);
            percentProfit += priceChange * 100 * currentAmount;
            currentAmount = this.calcAmountFromPriceChange(currentAmount, priceChange);
          }
        }
      }

      if (kline.algorithms[algorithm]!.signal) {
        percentProfit -= this.calcCommission(kline, algorithm, commission, currentAmount);
        currentAmount = this.calcNewAmount(kline, algorithm, currentAmount);  // now include the new signal and new amount
        lastSignalKline = kline;
      }

      backtest.percentProfit = percentProfit;
    });

    return klines;
  }

  /**
   * calculate price change between 2 klines, e.g. 0.5 = +50%, -0.5 = -50%
   */
  private calcPriceChange(algorithm: Algorithm, currentKline: Kline, lastKline: Kline): number {
    const currentPrice = this.signalOrClosePrice(currentKline, algorithm);
    const lastPrice = this.signalOrClosePrice(lastKline, algorithm);
    return (currentPrice - lastPrice) / lastPrice;
  }

  /**
   * open positions have changing position sizes (amounts), e.g.
   * open position: buy for amount 2, price change: -0.5 (-50%), new amount = 2 - 0.5 * 2 = 1
   * open position: sell for amount -2, price change: 1 (+100%), new amount = -2 + 1 * 2 = 0  (liquidation)
   */
  private calcAmountFromPriceChange(currentAmount: number, priceChange: number): number {
    // TODO: handle liquidation events and set close signal if liquidated
    return currentAmount + priceChange * Math.abs(currentAmount);
  }

  private calcNewAmount(kline: Kline, algorithm: Algorithm, currentAmount: number): number {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signal: Signal = backtest.signal!;
    const amount: number = backtest.amount ?? 1;   // if amount is not present, use default amount of 1

    switch (signal) {
      case Signal.Close: return 0;
      case Signal.CloseBuy: return amount;
      case Signal.CloseSell: return -amount;
      case Signal.Buy: return currentAmount + amount;
      case Signal.Sell: return currentAmount - amount;
      default: return NaN;
    }
  }

  private calcCommission(kline: Kline, algorithm: Algorithm, baseCommission: number, currentAmount: number): number {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signal: Signal = backtest.signal!;
    const klineAmount: number = backtest.amount || 1;

    switch (signal) {
      case Signal.Buy:
      case Signal.Sell: return baseCommission * (klineAmount);
      case Signal.Close: return baseCommission * Math.abs(currentAmount);
      case Signal.CloseBuy:
      case Signal.CloseSell: return baseCommission * Math.abs(currentAmount) + baseCommission * klineAmount;
      default: return NaN;
    }
  }
}