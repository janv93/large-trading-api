import { Kline } from '../interfaces';
import Logger from './logger';

export default class Base {
  private logger = new Logger();
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

  protected handleError(err: any, symbol?: string, caller?: any) {
    if (symbol) {
      this.logErr('Error received for symbol ' + symbol + ':', this);
    }

    if (err.response && err.response.data) {
      this.logErr(err.response.data, this);
    } else {
      this.logErr(err, this);
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

  protected calcStartTime(timeframe: string): number {
    const unit = timeframe.slice(-1);
    const value = Number(timeframe.slice(0, timeframe.length - 1));
    const ms = this.timeframeToMilliseconds(timeframe);
    const now = Date.now();

    switch (unit) {
      case 'm': return now - ms * 200 * 1000; // 200k * 1 min = 138 days - 200k * 15 min = 2k days
      case 'h': return now - ms * Math.round(100 / value) * 1000; // 100k hours = 4k days
      case 'd': return now - ms * Math.round(10 / value) * 1000; // 10k days = 27 years
      case 'w': return now - ms * 2 * 1000; // 1k weeks = 38 years
      default: throw `timeframe ${timeframe} does not exist`;
    }
  }

  /**
   * check if last kline in db is too far in the past
   */
  protected klineOutdated(timeframe: string, lastOpen: number): boolean {
    const unit = timeframe.slice(-1);
    const now = Date.now();
    const diff = now - lastOpen;

    switch (unit) {
      case 'm': return diff > 15 * 60 * 1000; // 15 min
      default: return diff > 3 * this.timeframeToMilliseconds(timeframe); // 3 timeframes for anything > minutes
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise<void>(r => setTimeout(r, ms));
  }

  protected log(...args: any[]) {
    this.logger.log(...args);
  }

  protected logErr(...args: any[]) {
    this.logger.logErr(...args);
  }
}