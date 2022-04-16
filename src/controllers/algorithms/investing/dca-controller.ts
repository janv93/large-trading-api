import { BinanceKucoinKline } from '../../../interfaces';
import BaseController from '../../base-controller';


export default class DcaController extends BaseController {
  constructor() {
    super();
  }

  public setSignals(klines: Array<BinanceKucoinKline>): Array<BinanceKucoinKline> {
    klines.forEach((kline: BinanceKucoinKline, i: number) => {
      if (i % 10 === 0) {
        kline.signal = this.buySignal;
      }
    });

    return klines;
  }
}