import { Kline } from '../../interfaces';
import BaseController from '../base-controller';
import BinanceController from '../exchanges/binance-controller';

// WIP

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

  public generateMtf(timeframes: string[]) {
    const sortedTimeframes = this.sortTimeframes(timeframes);
    const smallestTimeframe = sortedTimeframes[0];
  }

  private sortTimeframes(timeframes: string[]): string[] {
    return timeframes.sort((a, b) => {
      return this.timeframesInOrder.indexOf(a) - this.timeframesInOrder.indexOf(b);
    });
  }

}
