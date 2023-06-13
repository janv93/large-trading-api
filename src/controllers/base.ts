import { Kline } from '../interfaces';

export default class Base {
  protected buySignal = 'BUY';
  protected closeBuySignal = 'CLOSEBUY';
  protected sellSignal = 'SELL';
  protected closeSellSignal = 'CLOSESELL';
  protected closeSignal = 'CLOSE';

  /**
   * 1 = green, -1 = red, 0 = steady
   */
  protected getKlineColor(kline: Kline) {
    const diff = Number(kline.prices.close) - Number(kline.prices.open)
    return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
  }

  protected handleError(err: any, symbol?: string) {
    if (symbol) {
      console.log('Error received for symbol ' + symbol + ':');
    }

    if (err.response && err.response.data) {
      console.log(err.response.data);
    } else {
      console.log(err);
    }
  }

  protected timeframeToMilliseconds(timeframe: string): number {
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

  protected timeframeToSeconds(timeframe: string): number {
    return this.timeframeToMilliseconds(timeframe) / 1000;
  }

  protected timeframeToMinutes(timeframe: string): number {
    return this.timeframeToSeconds(timeframe) / 60;
  }

  protected roundTimeToNearestTimeframe(timestamp: number, timeframe: number): number {
    return timestamp - timestamp % timeframe;
  }

  protected createUrl(baseUrl: string, queryObj: any): string {
    let url = baseUrl;
    let firstParam = true;

    Object.keys(queryObj).forEach(param => {
      const query = param + '=' + queryObj[param];
      firstParam ? url += '?' : url += '&';
      url += query;
      firstParam = false;
    });

    return url;
  }

  protected createQuery(queryObj: any): string {
    let url = '';
    let firstParam = true;

    Object.keys(queryObj).forEach(param => {
      const query = param + '=' + queryObj[param];
      firstParam ? url += '?' : url += '&';
      url += query;
      firstParam = false;
    });

    return url;
  }

  /**
   * normalize to values between 0 and 1
   */
  protected normalize(values: number[]): number[] {
    const minClose = Math.min(...values);
    const maxClose = Math.max(...values);
    const range = maxClose - minClose;

    return values.map(close => (close - minClose) / range);
  }

  /**
   * takes the difference priceDiffPercent between the open and current price, stopLoss and takeProfit in percent and returns if tp or sl are reached
   */
  protected isTpSlReached(entrySignal: string, priceDiffPercent: number, stopLoss: number, takeProfit: number): boolean {
    let slReached: boolean;
    let tpReached: boolean;

    if (entrySignal === this.buySignal || entrySignal === this.closeBuySignal) {
      slReached = priceDiffPercent < -stopLoss;
      tpReached = priceDiffPercent > takeProfit;
    } else {
      slReached = priceDiffPercent > stopLoss;
      tpReached = priceDiffPercent < -takeProfit;
    }

    return slReached || tpReached ? true : false;
  }

  protected invertSignal(signal: string): string {
    switch (signal) {
      case this.buySignal: return this.sellSignal;
      case this.sellSignal: return this.buySignal;
      case this.closeBuySignal: return this.closeSellSignal;
      case this.closeSellSignal: return this.closeBuySignal;
      default: return '';
    }
  }

  protected stringToBoolean(input: string): boolean {
    return input === 'true';
  }

  protected percentage(base: number, change: number): number {
    return (change - base) / base;
  }

  protected deletePropertiesEqualToValue(obj: object, value: any): object {
    const newObj = { ...obj };
    for (const prop in newObj) {
      if (Array.isArray(newObj[prop]) && Array.isArray(value) && newObj[prop].length === 0 && value.length === 0) {
        delete newObj[prop];
      } else if (newObj[prop] === value) {
        delete newObj[prop];
      }
    }
    return newObj;
  }

  protected timestampToDate(timestamp: number): string {
    return (new Date(timestamp)).toLocaleString('de-DE', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected timestampsToDateRange(timestampStart: number, timestampEnd: number): string {
    return `From ${this.timestampToDate(timestampStart)} to ${this.timestampToDate(timestampEnd)}`;
  }
}