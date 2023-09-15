import { Kline } from '../../../interfaces';
import Base from '../../base';


export default class Martingale extends Base {
  /**
   * scales into long position. the more price drops, the exponentially larger the position grows
   */
  public setSignals(klines: Kline[], threshold: number, exitMultiplier: number): Kline[] {
    let streak = 0;
    let lastClose = klines[0].prices.close;
    let isOpen = false;

    klines.forEach((kline: Kline) => {
      const close = kline.prices.close;
      const percentDiff = (lastClose - close) / lastClose;

      if (percentDiff > threshold) {  // if price drop sufficient, scale into long position
        if (streak > 1) {   // if sufficient amount of consecutive drops, start buying
          kline.signal = this.buySignal;
          kline.amount = Math.pow(2, streak - 1);
          isOpen = true;
        }

        streak++;
        lastClose = close;
      } else if (streak > 0 && percentDiff < -threshold * exitMultiplier) {  // if price increase sufficient, reset streak and restart from here
        streak = 0;
        lastClose = close;

        if (isOpen) {
          kline.signal = this.closeSignal;
          isOpen = false;
        }
      } else if (streak === 0 && close > lastClose) {   // new high reached
        lastClose = close;
      }
    });

    return klines;
  }
}