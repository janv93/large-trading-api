import { BinanceKucoinKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class FlashCrashController extends BaseController {
  constructor() {
    super();
  }

  public setSignals(klines: Array<BinanceKucoinKline>): Array<BinanceKucoinKline> {
    // WIP: react to rapid price decrease in short time interval
    // use martingale at resistances / max % drop
    return klines;
  }
}