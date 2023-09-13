import { Kline } from '../../interfaces';
import Base from '../base';

export default class Backtest extends Base {
  /**
   * @param klines the klines returned from /klinesWithAlgorithm
   * @param commission commission of exchange, e.g. 0.04
   * @param flowingProfit when true, calculates profit for every kline (false calculates only at signals)
   * @returns the klines with profits
   */
  public calcBacktestPerformance(klines: Kline[], commission: number, flowingProfit: boolean): Kline[] {
    let percentProfit = 0;
    let lastSignalKline: Kline;
    let currentAmount = 0;

    klines.forEach((kline: Kline, i: number) => {
      if (lastSignalKline) {
        if (flowingProfit) {  // recalculate profit every kline
          const profitChange = this.calcProfitChange(kline, klines[i - 1], lastSignalKline);
          percentProfit += profitChange * currentAmount;
        } else {  // recalculate profit only on signal
          if (kline.signal && lastSignalKline.signal !== this.closeSignal) {
            const profitChange = this.calcProfitChange(kline, lastSignalKline);
            percentProfit += profitChange * currentAmount;
          }
        }
      }

      if (kline.signal) {
        percentProfit -= this.calcCommission(commission, kline, currentAmount);
        currentAmount = this.calcAmount(currentAmount, kline);
        lastSignalKline = kline;
      }

      kline.percentProfit = percentProfit;
    });

    return klines;
  }

  private calcProfitChange(kline: Kline, lastKline: Kline, lastSignalKline?: Kline): number {
    const diff = kline.prices.close - lastKline.prices.close;
    return diff / (lastSignalKline ?? lastKline).prices.close * 100;
  }

  private calcCommission(baseCommission: number, signalKline: Kline, currentAmount: number): number {
    switch (signalKline.signal) {
      case this.closeSignal: return baseCommission * Math.abs(currentAmount);
      case this.buySignal:
      case this.sellSignal: return baseCommission * (signalKline.amount || 1);
      case this.closeBuySignal:
      case this.closeSellSignal: return baseCommission * Math.abs(currentAmount) + baseCommission * (signalKline.amount || 1);
      default: return NaN;
    }
  }

  private calcAmount(currentAmount: number, kline: Kline): number {
    const amount = kline.amount ?? 1;   // if amount is not present, use default amount of 1

    switch (kline.signal) {
      case this.closeSignal: return 0;
      case this.closeBuySignal: return amount;
      case this.closeSellSignal: return -amount;
      case this.buySignal: return currentAmount + amount;
      case this.sellSignal: return currentAmount - amount;
      default: return NaN;
    }
  }
}