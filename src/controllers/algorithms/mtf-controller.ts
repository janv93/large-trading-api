import { BinanceKucoinKline } from '../../interfaces';
import BaseController from '../base-controller';
import BinanceController from '../exchanges/binance-controller';

export default class MtfController extends BaseController {
  private binanceController = new BinanceController();

  private timeframesInOrder = [
    '1m',
    '5m',
    '15m',
    '30m',
    '1h',
    '4h',
    '1D',
    '1W'
  ];

  constructor() {
    super();
  }

  public generateMtf(timeframes: Array<string>) {
    const sortedTimeframes = this.sortTimeframes(timeframes);
    const smallestTimeframe = sortedTimeframes[0];
  }

  private sortTimeframes(timeframes: Array<string>): Array<string> {
    return timeframes.sort((a, b) => {
      return this.timeframesInOrder.indexOf(a) - this.timeframesInOrder.indexOf(b);
    });
  }

}