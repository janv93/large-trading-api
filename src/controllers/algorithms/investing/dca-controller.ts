import { Kline } from '../../../interfaces';
import BaseController from '../../base-controller';


export default class DcaController extends BaseController {
  public setSignals(klines: Kline[]): Kline[] {
    klines.forEach((kline: Kline, i: number) => {
      if (i % 10 === 0) {
        kline.signal = this.buySignal;
      }
    });

    return klines;
  }
}