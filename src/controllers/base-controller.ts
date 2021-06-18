export default class BaseController {
  /**
   * 1 = green, -1 = red, 0 = steady
   */
  public getKlineColor(kline) {
    const diff = Number(kline[4]) - Number(kline[1])
    return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
  }
}