import { cloneDeep } from 'lodash';
import { Algorithm, BacktestData, Kline, Signal, Timeframe } from '../interfaces';
import Logger from './logger';

export default class Base {
  private logger = new Logger();

  /**
   * 1 = green, -1 = red, 0 = steady
   */
  protected getKlineColor(kline: Kline) {
    const diff = Number(kline.prices.close) - Number(kline.prices.open)
    return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
  }

  protected handleError(err: any, symbol?: string, caller: any = this) {
    if (symbol) {
      this.logErr('Error received for symbol ' + symbol + ':', caller);
    }

    if (err.response && err.response.data) {
      this.logErr(err.response.data, caller);
    } else {
      this.logErr(err, caller);
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
  protected normalizeBetween0And1(values: number[]): number[] {
    const minClose = Math.min(...values);
    const maxClose = Math.max(...values);
    const range = maxClose - minClose;

    return values.map(close => (close - minClose) / range);
  }

  /**
   * takes klines that already have buy or sell signals, computes the tp/sl for each signal and adds the tp/sl signals by subtracting the original position amount
   * can't set a close signal since multiple position may be open or it could overwrite existing signal
   */
  protected addTpSlSignals(klines: Kline[], algorithm: Algorithm, stopLoss: number, takeProfit: number) {
    let openPositions: Kline[] = [];

    klines.forEach((currentKline: Kline) => {
      let currentBacktest: BacktestData | undefined = currentKline.algorithms[algorithm];

      // push klines to check for tp/sl. has to happen before setting tp/sl, because tp/sl modifies signal
      if (currentBacktest?.signal && currentBacktest.signal !== Signal.Close) {
        openPositions.push(this.clone(currentKline)); // clone kline before modifications
      }

      openPositions = openPositions.filter((openKline: Kline) => {
        // if openKline = currentKline, then no tp/sl handling (not possible intrakline)
        if (openKline.times.open === currentKline.times.open) return true;

        const openBacktest: BacktestData = openKline.algorithms[algorithm]!;
        const tpSlTriggerPrice: number | null = this.getTpSlTriggerPrice(openKline, currentKline, algorithm, stopLoss, takeProfit);

        if (tpSlTriggerPrice) {
          // add inverse signal to current signal, e.g. original signal was buy and tp reached, then add sell with equal amount to current signal
          const invertedPositionBacktest: BacktestData = { signal: this.invertSignal(openBacktest.signal!)!, amount: openBacktest.amount!, signalPrice: tpSlTriggerPrice };
          const combinedBacktest: BacktestData = this.combineBacktestData(currentBacktest, invertedPositionBacktest);
          currentKline.algorithms[algorithm] = combinedBacktest;
          currentBacktest = combinedBacktest; // update current backtest for next open position iteration. in js, when a = b and b = c, then a != c, so have to a = c
          return false; // remove position from openPositions if tp/sl is reached
        }

        return true;  // keep if not reached
      });

      // normalize signal price to be between low and high price of the kline
      currentKline.algorithms[algorithm]!.signalPrice = this.fitPriceInKlinePriceRange(currentKline, currentKline.algorithms[algorithm]?.signalPrice);
    });
  }

  /**
   * combines two signals, e.g. buy 1 and sell 2 = sell 1
   * or closebuy 1 + sell 2 = closesell 1
   * or close + buy 1 = closebuy 1
   */
  protected combineBacktestData(backtest1?: BacktestData, backtest2?: BacktestData): BacktestData {
    const signal1: Signal | undefined = backtest1?.signal;
    const amount1: number = backtest1?.amount || 1;
    let signalPrice1: number | undefined = backtest1?.signalPrice;
    const signal2: Signal | undefined = backtest2?.signal;
    const amount2: number = backtest2?.amount || 1;
    let signalPrice2: number | undefined = backtest2?.signalPrice;
    const amountSum: number = amount1 + amount2;
    // if either is undefined, assign it to the other
    signalPrice1 = signalPrice1 ?? signalPrice2;
    signalPrice2 = signalPrice2 ?? signalPrice1;
    const signalPricesDefined = signalPrice1 && signalPrice2;
    const signalPriceSum: number | undefined = signalPricesDefined ? signalPrice1! * amount1 + signalPrice2! * amount2 : undefined; // weigh prices by their amount
    const signalPriceAverage: number | undefined = signalPricesDefined ? signalPriceSum! / amountSum : undefined;

    if (!signal1) {
      return { signal: signal2, amount: amount2, signalPrice: signalPrice2 };
    }

    if (!signal2) {
      return { signal: signal1, amount: amount1, signalPrice: signalPrice1 };
    }

    let newSignal: BacktestData = {};

    if (signal1 === Signal.Buy) {
      switch (signal2) {
        case Signal.Buy: newSignal = { signal: Signal.Buy, amount: amountSum }; break;
        case Signal.Sell: newSignal = amount1 > amount2 ? { signal: Signal.Buy, amount: amount1 - amount2 } : { signal: Signal.Sell, amount: amount2 - amount1 }; break;
        case Signal.Close: newSignal = { signal: Signal.CloseBuy, amount: amount1 }; break;
        case Signal.CloseBuy: newSignal = { signal: Signal.CloseBuy, amount: amountSum }; break;
        case Signal.CloseSell: newSignal = amount1 > amount2 ? { signal: Signal.CloseBuy, amount: amount1 - amount2 } : { signal: Signal.CloseSell, amount: amount2 - amount1 }; break;
      }
    } else if (signal1 === Signal.Sell) {
      switch (signal2) {
        case Signal.Buy: newSignal = amount1 > amount2 ? { signal: Signal.Sell, amount: amount1 - amount2 } : { signal: Signal.Buy, amount: amount2 - amount1 }; break;
        case Signal.Sell: newSignal = { signal: Signal.Sell, amount: amountSum }; break;
        case Signal.Close: newSignal = { signal: Signal.CloseSell, amount: amount1 }; break;
        case Signal.CloseBuy: newSignal = amount1 > amount2 ? { signal: Signal.CloseSell, amount: amount1 - amount2 } : { signal: Signal.CloseBuy, amount: amount2 - amount1 }; break;
        case Signal.CloseSell: newSignal = { signal: Signal.CloseSell, amount: amountSum }; break;
      }
    } else if (signal1 === Signal.Close) {
      switch (signal2) {
        case Signal.Buy: newSignal = { signal: Signal.CloseBuy, amount: amount2 }; break;
        case Signal.Sell: newSignal = { signal: Signal.CloseSell, amount: amount2 }; break;
        case Signal.Close: newSignal = { signal: Signal.Close }; break;
        case Signal.CloseBuy: newSignal = { signal: Signal.CloseBuy, amount: amount2 }; break;
        case Signal.CloseSell: newSignal = { signal: Signal.CloseSell, amount: amount2 }; break;
      }
    } else if (signal1 === Signal.CloseBuy) {
      switch (signal2) {
        case Signal.Buy: newSignal = { signal: Signal.CloseBuy, amount: amountSum }; break;
        case Signal.Sell: newSignal = amount1 > amount2 ? { signal: Signal.CloseBuy, amount: amount1 - amount2 } : { signal: Signal.CloseSell, amount: amount2 - amount1 }; break;
        case Signal.Close: newSignal = { signal: Signal.CloseBuy, amount: amount1 }; break;
        case Signal.CloseBuy: newSignal = { signal: Signal.CloseBuy, amount: amountSum }; break;
        case Signal.CloseSell: newSignal = amount1 > amount2 ? { signal: Signal.CloseBuy, amount: amount1 - amount2 } : { signal: Signal.CloseSell, amount: amount2 - amount1 }; break;
      }
    } else if (signal1 === Signal.CloseSell) {
      switch (signal2) {
        case Signal.Buy: newSignal = amount1 > amount2 ? { signal: Signal.CloseSell, amount: amount1 - amount2 } : { signal: Signal.CloseBuy, amount: amount2 - amount1 }; break;
        case Signal.Sell: newSignal = { signal: Signal.Sell, amount: amountSum }; break;
        case Signal.Close: newSignal = { signal: Signal.CloseSell, amount: amount1 }; break;
        case Signal.CloseBuy: newSignal = amount1 > amount2 ? { signal: Signal.CloseSell, amount: amount1 - amount2 } : { signal: Signal.CloseBuy, amount: amount2 - amount1 }; break;
        case Signal.CloseSell: newSignal = { signal: Signal.CloseSell, amount: amountSum }; break;
      }
    }

    newSignal.signalPrice = signalPriceAverage;

    if (newSignal.amount === 0) { // if amount is 0, then signal can be removed
      newSignal = {};
    }

    return newSignal;
  }

  /**
   * TODO: this is an old function and probably can be replaced
   * takes the difference priceDiffPercent between the open and current price, stopLoss and takeProfit in percent and returns if tp or sl are reached
   */
  protected isTpSlReached(entrySignal: Signal, priceDiffPercent: number, stopLoss: number, takeProfit: number): boolean {
    let slReached: boolean;
    let tpReached: boolean;

    if (entrySignal === Signal.Buy || entrySignal === Signal.CloseBuy) {
      slReached = priceDiffPercent < -stopLoss;
      tpReached = priceDiffPercent > takeProfit;
    } else {
      slReached = priceDiffPercent > stopLoss;
      tpReached = priceDiffPercent < -takeProfit;
    }

    return slReached || tpReached ? true : false;
  }

  /**
   * takes start and end kline and calculates if the price diff reaches tp/sl, then returns the trigger price
   */
  protected getTpSlTriggerPrice(openKline: Kline, currentKline: Kline, algorithm: Algorithm, stopLoss: number, takeProfit: number): number | null {
    const signalPrice: number = this.signalOrClosePrice(openKline, algorithm);
    const currentLow: number = currentKline.prices.low;
    const currentHigh: number = currentKline.prices.high;
    const slPrice: number = signalPrice - stopLoss * signalPrice;
    const tpPrice: number = signalPrice + takeProfit * signalPrice;
    const slReached: boolean = currentLow <= slPrice;
    const tpReached: boolean = currentHigh >= tpPrice;
    if (slReached) return slPrice;
    if (tpReached) return tpPrice;
    return null;  // no tp/sl reached
  }

  protected invertSignal(signal: Signal | null): Signal | null {
    switch (signal) {
      case Signal.Buy: return Signal.Sell;
      case Signal.Sell: return Signal.Buy;
      case Signal.Close: return Signal.Close;
      case Signal.CloseBuy: return Signal.CloseSell;
      case Signal.CloseSell: return Signal.CloseBuy;
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
  protected klineOutdated(timeframe: Timeframe, lastOpen: number): boolean {
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

  protected getTotalAmount(klines: Kline[], algorithm: Algorithm): number {
    return klines.reduce((a, c) => a + (c.algorithms[algorithm]!.amount || 0), 0);
  }

  protected calcProfitPerAmount(klines: Kline[], algorithm: Algorithm): number {
    const lastProfit = this.getLastProfit(klines, algorithm) || 0;
    const totalAmount = this.getTotalAmount(klines, algorithm);
    return totalAmount === 0 ? 0 : lastProfit / totalAmount;
  }

  protected signalOrClosePrice(kline: Kline, algorithm: Algorithm): number {
    return kline.algorithms[algorithm]?.signalPrice ?? kline.prices.close;
  }

  // fit price between kline low and high
  protected fitPriceInKlinePriceRange(kline: Kline, price?: number): number | undefined {
    if (!price) return undefined;
    const { low, high } = kline.prices;
    return Math.min(Math.max(price, low), high);
  }

  protected clone(original: any): any {
    return cloneDeep(original);
  }
}