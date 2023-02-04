import axios from 'axios';
import crypto from 'crypto';
import { Kline } from '../../interfaces';
import BaseController from '../base-controller';
import Database from '../../data/db';

export default class BinanceController extends BaseController {
  private database: Database = new Database();
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

  public getKlinesMultiple(symbol: string, times: number, timeframe: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.getKlinesRecursive(symbol, -1, times, timeframe, resolve, reject);
    });
  }

  /**
   * get last times * 1000 timeframes
   */
  public getKlinesRecursive(symbol: string, endTime: number, times: number, timeframe: string, resolve: Function, reject: Function): void {
    this.getKlines(symbol, timeframe, endTime).then(res => {
      this.klines = res.data.concat(this.klines);
      const start = this.klines[0][0];
      const end = start - this.timeframeToMilliseconds(timeframe);
      times--;

      if (times > 0) {
        this.getKlinesRecursive(symbol, end, times, timeframe, resolve, reject);
      } else {
        console.log();
        console.log('Received total of ' + this.klines.length + ' klines');
        const firstDate = new Date(this.klines[0][0]);
        console.log('First date: ' + firstDate);
        const lastDate = new Date(this.klines[this.klines.length - 1][0]);
        console.log('Last date: ' + lastDate);
        console.log();
        const binanceKlines = this.mapResult(this.klines);
        resolve(binanceKlines);
        this.klines = [];
      }

    }).catch(err => {
      this.handleError(err);
      reject(err);
    });
  }

  /**
   * get startTime to now timeframes
   */
  public getKlinesRecursiveFromDateUntilNow(symbol: string, startTime: number, timeframe: string, resolve: Function, reject: Function): void {
    this.getKlines(symbol, timeframe, undefined, startTime).then(res => {
      this.klines = this.klines.concat(res.data);
      const end: number = this.klines[this.klines.length - 1][0];
      const start: number = end + this.timeframeToMilliseconds(timeframe);
      const now = Date.now();

      if (start < now) {
        this.getKlinesRecursiveFromDateUntilNow(symbol, start, timeframe, resolve, reject);
      } else {
        console.log();
        console.log('Received total of ' + this.klines.length + ' klines');
        const firstDate = new Date(this.klines[0][0]);
        console.log('First date: ' + firstDate);
        const lastDate = new Date(this.klines[this.klines.length - 1][0]);
        console.log('Last date: ' + lastDate);
        console.log();
        const binanceKlines = this.mapResult(this.klines);
        resolve(binanceKlines);
        this.klines = [];
      }
    }).catch(err => {
      this.handleError(err);
      reject(err);
    });
  }

  /**
   * initialize database with klines from predefined start date until now
   * allows to cache already requested klines and only request recent klines
   */
  public initKlinesDatabase(symbol: string, timeframe: string): Promise<any> {
    const timespan = this.timeframeToMilliseconds(timeframe) * 1000 * 100;
    const startTime = Date.now() - timespan;

    return new Promise((resolve, reject) => {
      this.database.findKlines(symbol, timeframe).then(res => {
        if (res.length === 0) {
          new Promise<Array<Kline>>((resolve, reject) => {
            this.getKlinesRecursiveFromDateUntilNow(symbol, startTime, timeframe, resolve, reject);
          }).then(newKlines => {
            const insert = {
              symbol,
              timeframe,
              klines: newKlines
            };

            this.database.insert(insert);
            resolve({ message: 'Database initialized with ' + newKlines.length + ' klines' });
          }).catch(err => {
            this.handleError(err);
            reject(err);
          });
        } else {
          const dbKlines = res[0].klines;
          const lastKline = dbKlines[dbKlines.length - 1];

          new Promise<Array<Kline>>((resolve, reject) => {
            this.getKlinesRecursiveFromDateUntilNow(symbol, lastKline.times.open, timeframe, resolve, reject);
          }).then(newKlines => {
            newKlines.shift();    // remove first kline, since it's the same as last of dbKlines
            const mergedKlines = dbKlines.concat(newKlines);
            console.log('Added ' + newKlines.length + ' new klines to database');
            console.log();
            this.database.updateKlines(symbol, timeframe, mergedKlines).then(() => {
              this.database.findKlines(symbol, timeframe).then(updatedKlines => {
                resolve(updatedKlines[0].klines);
              }).catch(err => {
                this.handleError(err);
                reject(err);
              });
            }).catch(err => {
              this.handleError(err);
            });
          }).catch(err => {
            this.handleError(err);
          });
        }
      }).catch(err => {
        this.handleError(err);
      });
    });
  }

  public mapResult(klines: Array<any>): Array<Kline> {
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

    const query = 'symbol=' + symbol + 'USDT' + '&leverage=' + leverage + '&timestamp=' + now;
    const hmac = this.createHmac(query);

    const options = {
      headers: {
        'X-MBX-APIKEY': process.env.binance_api_key
      }
    };

    const url = 'https://fapi.binance.com/fapi/v1/leverage?' + query + '&signature=' + hmac;

    return axios.post(url, null, options);
  }

  public long(symbol, quantity): Promise<any> {
    return this.createOrder(symbol, 'BUY', quantity).then(() => {
      console.log('LONG position opened');
    }).catch(err => this.handleError(err));
  }

  public short(symbol, quantity): Promise<any> {
    return this.createOrder(symbol, 'SELL', quantity).then(() => {
      console.log('SHORT position opened');
    }).catch(err => this.handleError(err));
  }

  public createOrder(symbol: string, side: string, quantity: number): Promise<any> {
    const now = Date.now();

    let query =
      'symbol=' + symbol + 'USDT'
      + '&timestamp=' + now
      + '&side=' + side
      + '&type=' + 'MARKET';

    query += '&quantity=' + quantity;

    const hmac = this.createHmac(query);

    const options = {
      headers: {
        'X-MBX-APIKEY': process.env.binance_api_key
      }
    };

    const url = 'https://fapi.binance.com/fapi/v1/order?' + query + '&signature=' + hmac;

    return axios.post(url, null, options);
  }

  public async getSymbols(): Promise<string[]> {
    const baseUrl = 'https://api.binance.com/api/v3/exchangeInfo';
    const res = await axios.get(baseUrl);

    const symbols = res.data.symbols
      .map(s => s.symbol)
      .filter(s => s.includes('USDT') || s.includes('BUSD'))
      .filter(s => (!s.includes('UP') && !s.includes('DOWN')))
      .map(s => s.replace(/USDT|BUSD/g, ''))
      .map(s => s.toLowerCase());

      const uniqueSymbols = symbols.filter((item, index) => symbols.indexOf(item) === index);
      uniqueSymbols.sort();

    return uniqueSymbols;
  }

  private createHmac(query): string {
    return crypto.createHmac('sha256', process.env.binance_api_key_secret as any).update(query).digest('hex');
  }

}