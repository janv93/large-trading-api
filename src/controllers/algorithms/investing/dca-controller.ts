import { Kline } from '../../../interfaces';
import BaseController from '../../base-controller';


export default class DcaController extends BaseController {
  constructor() {
    super();
  }

  public setSignals(klines: Array<Kline>): Array<Kline> {
    klines.forEach((kline: Kline, i: number) => {
      if (i % 10 === 0) {
        kline.signal = this.buySignal;
      }
    });

    return klines;
  }
}