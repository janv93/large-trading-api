import { Kline } from '../../../interfaces';
import Base from '../../base';


export default class Dca extends Base {
  public setSignals(klines: Kline[]): Kline[] {
    klines.forEach((kline: Kline, i: number) => {
      if (i % 10 === 0) {
        kline.signal = this.buySignal;
      }
    });

    return klines;
  }
}