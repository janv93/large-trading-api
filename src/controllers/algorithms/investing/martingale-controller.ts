import { Kline } from '../../../interfaces';
import BaseController from '../../base-controller';


export default class MartingaleController extends BaseController {
  constructor() {
    super();
  }

  public setSignals(klines: Array<Kline>, threshold: number): Array<Kline> {
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