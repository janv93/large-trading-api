import { BinanceKucoinKline } from '../../../interfaces';
import BaseController from '../../base-controller';


export default class MartingaleController extends BaseController {
  constructor() {
    super();
  }

  public setSignals(klines: Array<BinanceKucoinKline>): Array<BinanceKucoinKline> {
    const threshold = 0.1;
    let streak = 0;
    let lastClose;

    klines.forEach((kline: BinanceKucoinKline, i: number) => {
      if (i === 0) {
        lastClose = kline.prices.close;
      } else {
        const close = kline.prices.close;
        const percentDiff = (lastClose - close) / lastClose;

        if (percentDiff > threshold) {
          kline.signal = this.buySignal;
          kline.amount = Math.pow(2, streak);
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