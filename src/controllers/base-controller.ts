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
}