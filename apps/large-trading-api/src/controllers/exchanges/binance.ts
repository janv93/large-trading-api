import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { Bar, Exchange, Timeframe, Tweet } from '@shared';
import Base from '../../base';
import { createUrl, calcStartTime, isBarOutdated, timeframeToMilliseconds, timestampsToDateRange, sleep } from '@shared';
import database from '../../data/database';

class Binance extends Base {
  readonly exchange = Exchange.Binance;
  private readonly usdPairs: string[] = ['USDT', 'BUSD', 'USDC'];
  private rateLimitPerMinute = 400; // 2400 is per minute limit, but fetching 1k bars costs 5 weight, 2400/5 = 480, plus some buffer
  private requestsSentThisMinute = 0;

  public async getBars(symbol: string, timeframe: Timeframe, endTime?: number, startTime?: number): Promise<Bar[]> {
    const baseUrl = 'https://fapi.binance.com/fapi/v1/klines';

    const query = {
      limit: '1000',
      interval: timeframe ? timeframe : Timeframe._1Minute,
      symbol: symbol
    };

    if (endTime && endTime > 0) {
      query['endTime'] = endTime;
    }

    if (startTime && startTime > 0) {
      query['startTime'] = startTime;
    }

    const barUrl = createUrl(baseUrl, query);
    this.log('GET ' + barUrl);

    try {
      await this.waitIfRateLimitReached();
      const response: AxiosResponse = await axios.get(barUrl);
      const result: Bar[] = this.mapBars(symbol, timeframe, response.data);
      return result;
    } catch (err) {
      this.handleError(err, symbol);
      return [];
    }
  }

  public async getBarsUntilNextFullHour(symbol: string, startTime: number): Promise<any> {
    const baseUrl = 'https://fapi.binance.com/fapi/v1/klines';
    const interval = Timeframe._1Minute;
    const limit = 60 - (new Date(startTime).getMinutes());

    const query = {
      limit: limit.toString(),
      interval,
      symbol,
      startTime
    };

    const barUrl = createUrl(baseUrl, query);

    this.log('GET ' + barUrl);
    return axios.get(barUrl);
  }

  /**
   * get startTime to now timeframes
   */
  public async getBarsFromStartUntilNow(symbol: string, startTime: number, timeframe: Timeframe): Promise<Bar[]> {
    const bars: Bar[] = [];
    let nextStart = startTime;
    const now = Date.now() - timeframeToMilliseconds(timeframe);

    while (nextStart < now) {
      const newBars = await this.getBars(symbol, timeframe, undefined, nextStart);
      bars.push(...newBars);

      if (newBars.length) {
        const end = newBars[newBars.length - 1].times.open;
        nextStart = end + timeframeToMilliseconds(timeframe);
      } else {
        nextStart = now;  // no bars found
      }
    }

    if (bars.length === 0) {
      return [];
    }

    const dateRange = timestampsToDateRange(bars[0].times.open, bars[bars.length - 1].times.open)
    this.log(`${bars.length} ${symbol} bars received - ${dateRange}`);

    bars.sort((a, b) => a.times.open - b.times.open);
    return bars;
  }

  /**
   * initialize database with bars from predefined start date until now
   * allows to cache already requested bars and only request recent bars
   */
  public async initBarsDatabase(symbol: string, timeframe: Timeframe): Promise<Bar[]> {
    const startTime: number = calcStartTime(timeframe);
    const dbBars: Bar[] = await database.getBars(symbol, timeframe, this.exchange);

    // not in database yet
    if (!dbBars || !dbBars.length) {
      const newBars: Bar[] = await this.getBarsFromStartUntilNow(symbol, startTime, timeframe);

      if (newBars.length) {
        await database.writeBars(newBars);
        this.log(`${newBars.length} ${symbol} bars initialized in database`);
      }

      return newBars;
    }

    // already in database
    const lastBar: Bar = dbBars[dbBars.length - 1];
    const newStart: number = lastBar.times.open;

    if (isBarOutdated(timeframe, newStart)) {
      const newBars: Bar[] = await this.getBarsFromStartUntilNow(symbol, newStart, timeframe);
      newBars.shift();    // remove first bar, since it's the same as last of dbBars
      this.log(`${newBars.length} new ${symbol} bars added to database`);
      await database.writeBars(newBars);
      const mergedBars: Bar[] = dbBars.concat(newBars);
      return mergedBars;
    } else {
      this.log(`${symbol} already up to date`);
      return dbBars;
    }
  }

  public setLeverage(symbol: string, leverage: number): Promise<any> {
    const now = Date.now();

    const query = {
      symbol: symbol + 'USDT',
      leverage: leverage,
      timestamp: now
    };

    const hmac = this.createHmac(query);

    const options = {
      headers: {
        'X-MBX-APIKEY': process.env.binance_api_key
      }
    };

    const url = createUrl('https://fapi.binance.com/fapi/v1/leverage', { ...query, signature: hmac });
    return axios.post(url, null, options);
  }

  public async short(symbol: string, quantity: number): Promise<void> {
    try {
      await this.createOrder(symbol, 'SELL', quantity);
      this.log('SHORT position opened');
    } catch (err) {
      this.handleError(err, symbol);
      throw err;
    }
  }

  public async long(symbol: string, quantity: number): Promise<void> {
    try {
      await this.createOrder(symbol, 'BUY', quantity);
      this.log('LONG position opened');
    } catch (err) {
      this.handleError(err, symbol);
      throw err;
    }
  }

  public createOrder(symbol: string, side: string, quantity: number): Promise<any> {
    const now: number = Date.now();

    const queryObj = {
      symbol: symbol + 'USDT',
      timestamp: now,
      side: side,
      type: 'MARKET',
      quantity: quantity
    };

    const hmac: string = this.createHmac(createUrl('', queryObj));
    const url: string = createUrl('https://fapi.binance.com/fapi/v1/order', {
      ...queryObj,
      signature: hmac
    });

    const options = {
      headers: {
        'X-MBX-APIKEY': process.env.binance_api_key
      }
    };

    return axios.post(url, null, options);
  }

  public async getPairs(): Promise<string[]> {
    this.log(`Get binance usd pairs`);
    const dbSymbols: string[] | null = await database.getBinanceSymbolsIfUpToDate();
    if (dbSymbols) return dbSymbols;
    const baseUrl = 'https://api.binance.com/api/v3/exchangeInfo';
    const res: AxiosResponse = await axios.get(baseUrl);
    const invalidSubstrings: string[] = ['UP', 'DOWN', 'SHIBUSDT', 'SHIBBUSD', 'SHIBUSDC']; // bugged or redundant tokens

    const symbols: string[] = res.data.symbols
      .map(s => s.symbol)
      .filter(s => this.usdPairs.some(coin => s.includes(coin)))
      .filter(s => !invalidSubstrings.some(sub => s.includes(sub)));

    const uniqueSymbols: string[] = symbols.filter((symbol: string, index: number) => symbols.indexOf(symbol) === index);
    uniqueSymbols.sort();
    await database.updateBinanceSymbols(uniqueSymbols);
    return uniqueSymbols;
  }

  public pairsToSymbols(pairs: string[]): string[] {
    return pairs.map(p => this.pairToSymbol(p));
  }

  // 'BTCUSDT' to 'btc'
  public pairToSymbol(pair: string): string {
    return pair.replace(new RegExp(this.usdPairs.join('|'), 'g'), '').toLowerCase();
  }

  // 'btc' to e.g. 'BTCUSDT' or 'BTCBUSD'
  public symbolsToPairs(symbols: string[], pairList: string[]): Array<string | undefined> {
    return symbols.map(s => this.symbolToPair(s, pairList));
  }

  public symbolToPair(symbol: string, pairList: string[]): string | undefined {
    return this.usdPairs
      .map(coin => symbol.toUpperCase() + coin)
      .find(pair => pairList.includes(pair));
  }

  // add all tweets with same time to their bars
  public addTweetsToBars(bars: Bar[], tweets: Tweet[]): void {
    bars.forEach((k, i) => {
      const nextBarTime = bars[i + 1]?.times?.open;

      if (nextBarTime) {
        const tweetsWithSameTime = tweets.filter(t => t.time >= k.times.open && t.time < nextBarTime);
        k.tweets = tweetsWithSameTime;
      }
    });
  }

  private createHmac(query): string {
    return crypto.createHmac('sha256', process.env.binance_api_key_secret as any).update(query).digest('hex');
  }

  private mapBars(symbol: string, timeframe: Timeframe, bars: any): Bar[] {
    return bars.map(k => {
      return {
        symbol,
        exchange: this.exchange,
        timeframe,
        times: {
          open: k[0],
          close: k[6]
        },
        prices: {
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4])
        },
        volume: Number(k[5]),
        numberOfTrades: k[8],
        algorithms: {}
      };
    });
  }

  private async waitIfRateLimitReached(): Promise<void> {
    this.requestsSentThisMinute++;

    // wait at rate limit
    if (this.requestsSentThisMinute >= this.rateLimitPerMinute) {
      this.log('Rate limit reached, waiting');
      await sleep(61000);
      this.requestsSentThisMinute = 0;
    }
  }
}

export default new Binance();