import axios from 'axios';
import crypto from 'crypto';
import { Kline } from '../../interfaces';
import BaseController from '../base-controller';
import database from '../../data/database';

export default class BinanceController extends BaseController {
  private database = database
  private klines = [];

  public getKlines(symbol: string, timeframe: string, endTime?: number, startTime?: number): Promise<any> {
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

    console.log('GET ' + klineUrl);
    return axios.get(klineUrl);
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

    console.log('GET' + 'klineUrl');
    return axios.get(klineUrl);
  }

  public async getKlinesMultiple(symbol: string, times: number, timeframe: string): Promise<any> {
    try {
      const binanceKlines = await this.getKlinesRecursive(symbol, -1, times, timeframe);
      return binanceKlines;
    } catch (err) {
      this.handleError(err, symbol);
      throw err;
    }
  }

  /**
   * get last times * 1000 timeframes
   */
  public async getKlinesRecursive(symbol: string, endTime: number, times: number, timeframe: string): Promise<Kline[]> {
    while (times > 0) {
      try {
        const res = await this.getKlines(symbol, timeframe, endTime);
        this.klines = res.data.concat(this.klines);
        endTime = this.klines[0][0] - this.timeframeToMilliseconds(timeframe);
        times--;
      } catch (err) {
        this.handleError(err, symbol);
        throw err;
      }
    }

    console.log();
    console.log('Received total of ' + this.klines.length + ' klines');
    const firstDate = new Date(this.klines[0][0]);
    console.log('First date: ' + firstDate);
    const lastDate = new Date(this.klines[this.klines.length - 1][0]);
    console.log('Last date: ' + lastDate);
    console.log();
    const binanceKlines = this.mapResult(this.klines);
    this.klines = [];
    return binanceKlines;
  }

  /**
   * get startTime to now timeframes
   */
  public async getKlinesRecursiveFromDateUntilNow(symbol: string, startTime: number, timeframe: string): Promise<Kline[]> {
    try {
      const res = await this.getKlines(symbol, timeframe, undefined, startTime);
      this.klines = this.klines.concat(res.data);
      const end = this.klines[this.klines.length - 1][0];
      const nextStart = end + this.timeframeToMilliseconds(timeframe);
      const now = Date.now();

      if (nextStart < now) {
        return this.getKlinesRecursiveFromDateUntilNow(symbol, nextStart, timeframe);
      } else {
        console.log(`Received total of ${this.klines.length} klines`);
        console.log(`First date: ${new Date(this.klines[0][0])}`);
        console.log(`Last date: ${new Date(this.klines[this.klines.length - 1][0])}`);
        const binanceKlines = this.mapResult(this.klines);
        this.klines = [];
        return binanceKlines;
      }
    } catch (err) {
      this.handleError(err, symbol);
      throw err;
    }
  }

  /**
   * initialize database with klines from predefined start date until now
   * allows to cache already requested klines and only request recent klines
   */
  public async initKlinesDatabase(symbol: string, timeframe: string): Promise<any> {
    const timespan = this.timeframeToMilliseconds(timeframe) * 1000 * 100;
    const startTime = Date.now() - timespan;

    try {
      const res = await this.database.findSnapshot(symbol, timeframe);
      const dbKlines = res?.klines || [];
      const lastKline = dbKlines[dbKlines.length - 1];

      const newKlines = await this.getKlinesRecursiveFromDateUntilNow(
        symbol,
        lastKline?.times.open || startTime,
        timeframe
      );

      if (dbKlines.length === 0) {
        await this.database.writeSnapshot({ symbol, timeframe, klines: newKlines });
        return { message: `Database initialized with ${newKlines.length} klines` };
      } else {
        newKlines.shift();
        const mergedKlines = dbKlines.concat(newKlines);
        console.log(`Added ${newKlines.length} new klines to database`);
        console.log();
        await this.database.updateSnapshot(symbol, timeframe, mergedKlines);
        return (await this.database.findSnapshot(symbol, timeframe)).klines;
      }
    } catch (err) {
      this.handleError(err, symbol);
      throw err;
    }
  }

  public mapResult(klines: any[]): Kline[] {
    return klines.map(k => {
      return {
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
      console.log('SHORT position opened');
    } catch (err) {
      this.handleError(err, symbol);
      throw err;
    }
  }

  public async long(symbol: string, quantity: number): Promise<void> {
    try {
      await this.createOrder(symbol, 'BUY', quantity);
      console.log('LONG position opened');
    } catch (err) {
      this.handleError(err);
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

  public async getUsdtBusdSymbols(): Promise<string[]> {
    const baseUrl = 'https://api.binance.com/api/v3/exchangeInfo';
    const res = await axios.get(baseUrl);

    const symbols = res.data.symbols
      .map(s => s.symbol)
      .filter(s => s.includes('USDT') || s.includes('BUSD'))
      .filter(s => (!s.includes('UP') && !s.includes('DOWN')))

    const uniqueSymbols = symbols.filter((item, index) => symbols.indexOf(item) === index);
    uniqueSymbols.sort();
    return uniqueSymbols;
  }

  private createHmac(query): string {
    return crypto.createHmac('sha256', process.env.binance_api_key_secret as any).update(query).digest('hex');
  }

}