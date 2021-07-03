import { BinanceKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class BacktestController extends BaseController {
  constructor() {
    super();
  }

  public calcBacktestPerformance(klines: Array<BinanceKline>, commission: number): Array<BinanceKline> {
    let percentProfit = 0.0;
    let lastSignalKline: BinanceKline;

    klines.forEach(kline => {
      if (kline.signal) {
        if (lastSignalKline && lastSignalKline.signal !== this.closeSignal) {
          const diff = kline.prices.close - lastSignalKline.prices.close;
          const percentage = diff / lastSignalKline.prices.close * 100;

          // if buy->sell, add percentage, and vice versa
          percentProfit += lastSignalKline.signal === this.buySignal ? percentage : -percentage;
          percentProfit -= commission;
        }

        lastSignalKline = kline;
      }

      kline.percentProfit = percentProfit;
    });

    return klines;
  }
}