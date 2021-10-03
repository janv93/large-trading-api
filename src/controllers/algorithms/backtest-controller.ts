import { BinanceKucoinKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class BacktestController extends BaseController {
  constructor() {
    super();
  }

  public calcBacktestPerformance(klines: Array<BinanceKucoinKline>, commission: number): Array<BinanceKucoinKline> {
    let percentProfit = 0.0;
    let lastSignalKline: BinanceKucoinKline;

    klines.forEach(kline => {
      if (kline.signal) {
        if (lastSignalKline && lastSignalKline.signal !== this.closeSignal) {
          const diff = kline.prices.close - lastSignalKline.prices.close;
          const percentage = diff / lastSignalKline.prices.close * 100;

          percentProfit += lastSignalKline.signal === this.buySignal ? percentage : -percentage;

          if (kline.signal === this.closeSignal) {
            // if buy/sell->close, we pay 1x commission
            percentProfit -= commission;
          } else {
            // if buy/sell->sell/buy, we pay 2x commission
            percentProfit -= commission * 2;
          }
        } else {
          // if close->buy/sell, we pay 1x commission
          percentProfit -= commission;
        }

        lastSignalKline = kline;
      }

      kline.percentProfit = percentProfit;
    });

    return klines;
  }
}