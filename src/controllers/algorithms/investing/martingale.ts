import { Kline } from '../../../interfaces';
import Base from '../../base';


export default class Martingale extends Base {
  /**
   * scales into long position. the more price drops, the exponentially larger the position grows
   */
  public setSignals(klines: Kline[], threshold: number): Kline[] {
    let streak = 0;
    let lastClose = klines[0].prices.close;
    let totalAmount = 0;

    klines.forEach((kline: Kline) => {
      const close = kline.prices.close;
      const percentDiff = (lastClose - close) / lastClose;

      if (percentDiff > threshold) {  // if price drop sufficient, scale into long position
        if (streak > 0) {   // if sufficient amount of consecutive drops, start buying
          kline.signal = this.buySignal;
          kline.amount = Math.pow(2, streak - 1);
          totalAmount += kline.amount;
        }

        streak++;
        lastClose = close;
      } else if (streak > 0 && percentDiff < -threshold * 2) {  // if price increase sufficient, reset streak and restart from here
        streak = 0;
        lastClose = close;
        kline.signal = this.sellSignal;
        kline.amount = totalAmount;
        totalAmount = 0;
      } else if (streak === 0 && close > lastClose) {   // new high reached
        lastClose = close;
      }
    });

    return klines;
  }
}