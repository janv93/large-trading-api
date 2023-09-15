import axios from 'axios';
import crypto from 'crypto';
import { Kline, Tweet } from '../../interfaces';
import Base from '../base';
import database from '../../data/database';

export default class Binance extends Base {
  private database = database;

  public async getKlines(symbol: string, timeframe: string, endTime?: number, startTime?: number): Promise<Kline[]> {
    const baseUrl = 'https://fapi.binance.com/fapi/v1/klines';

    const query = {
      limit: '1000',
      interval: timeframe ? timeframe : '1m',
      symbol: symbol
    };

    if (endTime && endTime > 0) {
      query['endTime'] = endTime;
    }

    if (startTime && startTime > 0) {
      query['startTime'] = startTime;
    }

    const klineUrl = this.createUrl(baseUrl, query);
    this.log('GET ' + klineUrl, this);

    try {
      const response = await axios.get(klineUrl);
      const result = this.mapKlines(symbol, timeframe, response.data);
      return result;
    } catch (err) {
      this.handleError(err, symbol, this);
      return [];
    }
  }

  public async getKlinesUntilNextFullHour(symbol: string, startTime: number): Promise<any> {
    const baseUrl = 'https://fapi.binance.com/fapi/v1/klines';
    const interval = '1m';
    const limit = 60 - (new Date(startTime).getMinutes());

    const query = {
      limit: limit.toString(),
      interval,
      symbol,
      startTime
    };

    const klineUrl = this.createUrl(baseUrl, query);

    this.log('GET ' + klineUrl, this);
    return axios.get(klineUrl);
  }

  /**
   * get startTime to now timeframes
   */
  public async getKlinesFromStartUntilNow(symbol: string, startTime: number, timeframe: string): Promise<Kline[]> {
    const klines: Kline[] = [];
    let nextStart = startTime;
    const now = Date.now() - this.timeframeToMilliseconds(timeframe);

    while (nextStart < now) {
      const newKlines = await this.getKlines(symbol, timeframe, undefined, nextStart);
      klines.push(...newKlines);

      if (newKlines.length) {
        const end = newKlines[newKlines.length - 1].times.open;
        nextStart = end + this.timeframeToMilliseconds(timeframe);
      } else {
        nextStart = now;  // no klines found
      }
    }

    if (klines.length === 0) {
      return [];
    }

    const dateRange = this.timestampsToDateRange(klines[0].times.open, klines[klines.length - 1].times.open)
    this.log(`Received total of ${klines.length} klines: ${dateRange}`, this);

    klines.sort((a, b) => a.times.open - b.times.open);
    return klines;
  }

  /**
   * initialize database with klines from predefined start date until now
   * allows to cache already requested klines and only request recent klines
   */
  public async initKlinesDatabase(symbol: string, timeframe: string): Promise<Kline[]> {
    const startTime = this.calcStartTime(timeframe);
    const dbKlines = await this.database.getKlines(symbol, timeframe);

    // not in database yet
    if (!dbKlines || !dbKlines.length) {
      const newKlines = await this.getKlinesFromStartUntilNow(symbol, startTime, timeframe);

      if (newKlines.length) {
        await this.database.writeKlines(newKlines);
        this.log('Database initialized with ' + newKlines.length + ' klines', this);
      }

      return newKlines;
    }

    // already in database
    const lastKline = dbKlines[dbKlines.length - 1];
    const newStart = lastKline.times.open;

    if (this.klineOutdated(timeframe, newStart)) {
      const newKlines = await this.getKlinesFromStartUntilNow(symbol, newStart, timeframe);
      newKlines.shift();    // remove first kline, since it's the same as last of dbKlines
      this.log('Added ' + newKlines.length + ' new klines to database', this);
      await this.database.writeKlines(newKlines);
      const mergedKlines = dbKlines.concat(newKlines);
      return mergedKlines;
    } else {
      return dbKlines;
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

    const url = this.createUrl('https://fapi.binance.com/fapi/v1/leverage', { ...query, signature: hmac });
    return axios.post(url, null, options);
  }

  public async short(symbol: string, quantity: number): Promise<void> {
    try {
      await this.createOrder(symbol, 'SELL', quantity);
      this.log('SHORT position opened', this);
    } catch (err) {
      this.handleError(err, symbol, this);
      throw err;
    }
  }

  public async long(symbol: string, quantity: number): Promise<void> {
    try {
      await this.createOrder(symbol, 'BUY', quantity);
      this.log('LONG position opened', this);
    } catch (err) {
      this.handleError(err, symbol, this);
      throw err;
    }
  }

  public createOrder(symbol: string, side: string, quantity: number): Promise<any> {
    const now = Date.now();

    const queryObj = {
      symbol: symbol + 'USDT',
      timestamp: now,
      side: side,
      type: 'MARKET',
      quantity: quantity
    };

    const hmac = this.createHmac(this.createUrl('', queryObj));
    const url = this.createUrl('https://fapi.binance.com/fapi/v1/order', {
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

  public async getUsdtBusdPairs(): Promise<string[]> {
    const baseUrl = 'https://api.binance.com/api/v3/exchangeInfo';
    const res = await axios.get(baseUrl);

    const symbols = res.data.symbols
      .map(s => s.symbol)
      .filter(s => s.includes('USDT') || s.includes('BUSD'))
      .filter(s => (!s.includes('UP') && !s.includes('DOWN')));

    const uniqueSymbols = symbols.filter((item, index) => symbols.indexOf(item) === index);
    uniqueSymbols.sort();
    return uniqueSymbols;
  }

  public pairsToSymbols(pairs: string[]): string[] {
    return pairs.map(p => this.pairToSymbol(p));
  }

  // 'BTCUSDT' to 'btc'
  public pairToSymbol(pair: string): string {
    return pair.replace(/USDT|BUSD/g, '').toLowerCase();
  }

  public symbolsToPairs(symbols: string[], pairList: string[]): string[] {
    return symbols.map(s => this.symbolToPair(s, pairList));
  }

  // 'btc' to 'BTCUSDT' or 'BTCBUSD'
  public symbolToPair(symbol: string, pairList: string[]): string {
    const binanceSymbolUsdt = (symbol + 'usdt').toUpperCase();
    const binanceSymbolBusd = (symbol + 'busd').toUpperCase();
    const usdtSymbolExists = pairList.includes(binanceSymbolUsdt);
    const busdSymbolExists = pairList.includes(binanceSymbolBusd);

    if (usdtSymbolExists) {
      return binanceSymbolUsdt;
    } else if (busdSymbolExists) {
      return binanceSymbolBusd;
    } else {
      throw ('Could not map symbol ' + symbol + ' to corresponding pair.');
    }
  }

  // add all tweets with same time to their klines
  public addTweetsToKlines(klines: Kline[], tweets: Tweet[]): void {
    klines.forEach((k, i) => {
      const nextKlineTime = klines[i + 1]?.times?.open;

      if (nextKlineTime) {
        const tweetsWithSameTime = tweets.filter(t => t.time >= k.times.open && t.time < nextKlineTime);
        k.tweets = tweetsWithSameTime;
      }
    });
  }

  private createHmac(query): string {
    return crypto.createHmac('sha256', process.env.binance_api_key_secret as any).update(query).digest('hex');
  }

  private mapKlines(symbol: string, timeframe: string, klines: any): Kline[] {
    return klines.map(k => {
      return {
        symbol,
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
        numberOfTrades: k[8]
      };
    });
  }
}