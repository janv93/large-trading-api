import { Kline } from '../../../interfaces';
import Base from '../../base';


export default class Martingale extends Base {
  public setSignals(klines: Kline[], threshold: number): Kline[] {
    let streak = 0;
    let lastClose;

    klines.forEach((kline: Kline, i: number) => {
      if (i === 0) {
        lastClose = kline.prices.close;
      } else {
        const close = kline.prices.close;
        const percentDiff = (lastClose - close) / lastClose;

        if (percentDiff > threshold) {
          if (streak > 1) {
            kline.signal = this.buySignal;
            kline.amount = Math.pow(2, streak);
          }

          streak++;
          lastClose = kline.prices.close;
        } else if (percentDiff < -threshold) {
          streak = 0;
          lastClose = kline.prices.close;
        }
      }
    });

    return klines;
  }
}