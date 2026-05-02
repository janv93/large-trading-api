import { cloneDeep } from 'lodash';
import { Algorithm, BacktestSignal, Kline, Signal, Timeframe } from '@shared';
import Logger from './controllers/logger';

export default abstract class Base {
  protected logger = new Logger();

  /**
   * 1 = green, -1 = red, 0 = steady
   */
  protected getKlineColor(kline: Kline) {
    const diff = Number(kline.prices.close) - Number(kline.prices.open)
    return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
  }

  protected handleError(err: any, symbol?: string) {
    if (symbol) {
      this.logErr('Error received for symbol ' + symbol + ':');
    }

    if (err.response && err.response.data) {
      this.logErr(err.response.data);
    } else {
      this.logErr(err);
    }
  }

  protected timeframeToMilliseconds(timeframe: Timeframe): number {
    const unit = timeframe.slice(-1);
    const value = Number(timeframe.slice(0, timeframe.length - 1));

    switch (unit) {
      case 'm': return value * 60000;
      case 'h': return value * 60 * 60000;
      case 'd': return value * 24 * 60 * 60000;
      case 'w': return value * 7 * 24 * 60 * 60000;
      case 'M': return value * 30 * 24 * 60 * 60000;
      default: return -1;
    }
  }

  protected timeframeToSeconds(timeframe: Timeframe): number {
    return this.timeframeToMilliseconds(timeframe) / 1000;
  }

  protected timeframeToMinutes(timeframe: Timeframe): number {
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
      url += firstParam ? '?' : '&';
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
      url += firstParam ? '?' : '&';
      url += query;
      firstParam = false;
    });

    return url;
  }

  /**
   * normalize to values between 0 and 1
   */
  protected normalizeBetween0And1(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    if (range === 0) return values.map(() => 0);
    return values.map(v => (v - min) / range);
  }

  protected invertSignal(signal: Signal | null): Signal | null {
    switch (signal) {
      case Signal.Buy: return Signal.Sell;
      case Signal.Sell: return Signal.Buy;
      case Signal.CloseAll: return Signal.CloseAll;
      default: return null;
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

  protected calcStartTime(timeframe: Timeframe): number {
    const unit = timeframe.slice(-1);
    const value = Number(timeframe.slice(0, timeframe.length - 1));
    const ms = this.timeframeToMilliseconds(timeframe);
    const now = Date.now();
    const minTimestamp = 1000000000000; // Sept 2001 — minimum valid 13-digit ms timestamp, relevant for kucoin

    switch (unit) {
      case 'm': return Math.max(now - ms * 100 * 1000, minTimestamp); // 100k * 1 min = 69 days - 100k * 15 min = 1k days
      case 'h': return Math.max(now - ms * Math.round(100 / value) * 1000, minTimestamp); // 100k hours = 4k days
      case 'd': return Math.max(now - ms * Math.round(10 / value) * 1000, minTimestamp); // 10k days = 27 years
      case 'w': return Math.max(now - ms * 1000, minTimestamp); // 1k weeks = 38 years
      case 'M': return Math.max(now - ms * 100, minTimestamp);
      default: throw `timeframe ${timeframe} does not exist`;
    }
  }

  protected klineOutdated(timeframe: Timeframe, lastOpen: number, lastFetch?: number): boolean {
    const unit = timeframe.slice(-1);
    const now = Date.now();
    const timeframeMs = this.timeframeToMilliseconds(timeframe);

    // e.g. if timeframe 1h and last fetch < 1h ago there are no new klines
    if (lastFetch && (now - lastFetch) < timeframeMs) return false;

    const diff = now - lastOpen;
    switch (unit) {
      case 'm': return diff > 15 * 60 * 1000; // 15 min
      default: return diff > 3 * timeframeMs; // 3 timeframes for anything > minutes
    }
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise<void>(r => setTimeout(r, ms));
  }

  protected log(...args: any[]) {
    this.logger.log(...args, this.constructor.name);
  }

  protected logErr(...args: any[]) {
    this.logger.logErr(...args, this.constructor.name);
  }

  protected logProgress(percent: number) {
    this.logger.logProgress(percent, this.constructor.name);
  }

  protected forEachWithProgress(arr: any[], callback: (item: any, index: number) => void): void {
    arr.forEach((item, index) => {
      this.logProgress((index + 1) / arr.length * 100);
      callback(item, index);
    });
  }

  /**
   * (positive - negative klines) * profit
   */
  protected calcPerformanceSteadyAscent(klines: Kline[], algorithm: Algorithm): number {
    let positiveKlines = 0;
    let negativeKlines = 0;
    let lastProfit = 0;

    for (const kline of klines) {
      if (kline.algorithms[algorithm]!.percentProfit) {
        lastProfit = kline.algorithms[algorithm]!.percentProfit!;

        if (lastProfit > 0) {
          positiveKlines++;
        } else if (lastProfit < 0) {
          negativeKlines++;
        }
      }
    }

    const balance = positiveKlines - negativeKlines;
    const performance = balance * lastProfit;
    return performance;
  }

  /**
   * normalize profits logarithmically and calc average
   * useful when large profits are similarly valueable as small profits
   */
  protected calcAverageLogarithmicProfit(profits: number[]): number {
    const total = profits.reduce((a, c) => a + (Math.sign(c) * Math.log(Math.abs(c) + 1) ** 4), 0);  // exponent means logarithm stretches out and doesn't max as early
    return total / profits.length;
  }

  protected getLastProfit(klines: Kline[], algorithm: Algorithm): number | undefined {
    return klines.at(-1)?.algorithms[algorithm]!.percentProfit;
  }

  protected getTotalSize(klines: Kline[], algorithm: Algorithm): number {
    let totalSize = 0;

    klines.forEach((kline: Kline) => {
      kline.algorithms[algorithm]?.signals.forEach((signal: BacktestSignal) => {
        if (!this.isCloseSignal(signal.signal)) totalSize += signal.size!;
      });
    });

    return totalSize;
  }

  protected calcProfitPerAmount(klines: Kline[], algorithm: Algorithm): number {
    const lastProfit = this.getLastProfit(klines, algorithm) || 0;
    const totalAmount = this.getTotalSize(klines, algorithm);
    return totalAmount === 0 ? 0 : lastProfit / totalAmount;
  }

  protected clone(original: any): any {
    return cloneDeep(original);
  }

  protected calcAverage(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  protected calcStandardDeviation(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const average: number = this.calcAverage(numbers);
    const variance: number = numbers.reduce((sum, num) => sum + Math.pow(num - average, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }

  protected calcAverageChangeInPercent(numbers: number[]): number {
    if (numbers.length < 2) return 0;
    let totalChange = 0;

    for (let i = 1; i < numbers.length; i++) {
      const change = Math.abs(numbers[i] - numbers[i - 1]) / numbers[i - 1];
      totalChange += change;
    }

    return totalChange / (numbers.length - 1);
  }

  // e.g. 10 -> 15 = 0.5
  protected calcPriceChange(startPrice: number, endPrice: number): number {
    return (endPrice - startPrice) / startPrice;
  }

  protected isCloseSignal(signal?: Signal): boolean {
    if (!signal) return false;
    return [Signal.CloseAll, Signal.Close, Signal.Liquidation, Signal.TakeProfit, Signal.StopLoss].includes(signal);
  }

  protected isForceCloseSignal(signal?: Signal): boolean {
    const isCloseSignal: boolean = (this.isCloseSignal(signal));
    return isCloseSignal && signal !== Signal.CloseAll && signal !== Signal.Close;
  }

  protected getRandomBoolean(): boolean {
    return Math.random() < 0.5;
  }
}