import { BinanceKline } from '../interfaces';

export default class BaseController {
  public buySignal = 'BUY';
  public sellSignal = 'SELL';
  public closeSignal = 'CLOSE';

  /**
   * 1 = green, -1 = red, 0 = steady
   */
  public getKlineColor(kline: BinanceKline) {
    const diff = Number(kline.prices.close) - Number(kline.prices.open)
    return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
  }

  public handleError(err: any) {
    if (err.response && err.response.data) {
      console.log(err.response.data);
    } else {
      console.log(err);
    }
  }

  public timeframeToMilliseconds(timeframe: string): number {
    const unit = timeframe.slice(-1);
    const value = Number(timeframe.slice(0, timeframe.length - 1));

    switch (unit) {
      case 'm': return value * 60000;
      case 'h': return value * 60 * 60000;
      case 'd': return value * 24 * 60 * 60000;
      case 'w': return value * 7 * 24 * 60 * 60000;
      default: return -1;
    }
  }
}