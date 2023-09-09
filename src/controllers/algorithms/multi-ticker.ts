import { Kline } from '../../interfaces';
import Base from '../base';
import Nasdaq from '../other-apis/nasdaq';
import Alpaca from '../exchanges/alpaca';

export default class MultiTicker extends Base {
  public async setSignals(klines: Kline[]): Promise<any> {
    console.log(klines[0].symbol)
    return;
  }
}