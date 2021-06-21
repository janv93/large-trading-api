import { BinanceKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class BacktestController extends BaseController {
  constructor() {
    super();
  }

  public calcBacktestPerformance(klines: Array<BinanceKline>, commission: number, type: string): Array<BinanceKline> {
    switch (type) {
      case 'noClose': return this.calcPerformanceStrategyNoClose(klines, commission);
      case 'close': return this.calcPerformanceStrategyClose(klines, commission);
      default: return [];
    }
  }

  /**
   * calculate performance with no close strategy (strategy only containing buy and sell signals, revert strategy)
   */
  private calcPerformanceStrategyNoClose(klines: Array<BinanceKline>, commission: number): Array<BinanceKline> {
    let percentProfit = 0.0;
    let lastSignalKline: BinanceKline;

    klines.forEach(kline => {
      if (kline.signal) {
        if (lastSignalKline) {
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

  /**
   * calculate performance with close strategy (strategy containing buy, sell and close signals)
   */
  private calcPerformanceStrategyClose(klines: Array<BinanceKline>, commission: number): Array<BinanceKline> {
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