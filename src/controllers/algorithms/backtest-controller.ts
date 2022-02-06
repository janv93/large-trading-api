import { BinanceKucoinKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class BacktestController extends BaseController {
  constructor() {
    super();
  }

  public calcBacktestPerformance(klines: Array<BinanceKucoinKline>, commission: number, flowingProfit: boolean): Array<BinanceKucoinKline> {
    let percentProfit = 0;
    let lastSignalKline: BinanceKucoinKline;

    klines.forEach((kline: BinanceKucoinKline, i: number) => {
      if (lastSignalKline) {
        if (flowingProfit) {  // recalculate profit every kline
          const profitChange = this.calcProfitChange(kline, klines[i - 1], lastSignalKline);
          percentProfit += lastSignalKline.signal === this.buySignal ? profitChange : -profitChange;
        } else {  // recalculate profit only on signal close/reopen
          if (kline.signal && lastSignalKline.signal !== this.closeSignal) {
            const profitChange = this.calcProfitChange(kline, lastSignalKline);
            percentProfit += lastSignalKline.signal === this.buySignal ? profitChange : -profitChange;
          }
        }
      }

      if (kline.signal) {
        const currentCommission = this.calcCommission(commission, kline, lastSignalKline);
        percentProfit -= currentCommission;
        lastSignalKline = kline;
      }

      kline.percentProfit = percentProfit;
    });

    return klines;
  }

  private calcProfitChange(kline: BinanceKucoinKline, lastKline: BinanceKucoinKline, lastSignalKline?: BinanceKucoinKline): number {
    const diff = kline.prices.close - lastKline.prices.close;
    return diff / (lastSignalKline ?? lastKline).prices.close * 100;
  }

  /**
   * if close and open at once, double commission
   */
  private calcCommission(baseCommission: number, signalKline: BinanceKucoinKline, lastSignalKline: BinanceKucoinKline): number {
    if (signalKline.signal !== this.closeSignal && lastSignalKline && lastSignalKline.signal !== this.closeSignal) {
      return baseCommission * 2;
    } else {
      return baseCommission;
    }
  }
}