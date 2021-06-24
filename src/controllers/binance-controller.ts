import axios from 'axios';
import { BinanceKline } from '../interfaces';
import BaseController from './base-controller';
import Database from '../data/db';

export default class BinanceController extends BaseController {
  private database: Database = new Database();
  private klines = [];

  constructor() {
    super();
  }

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
  public getKlinesRecursive(symbol: string, endTime: number, times: number, timeframe: string, resolve: Function, reject: Function) {
    this.getKlines(symbol, timeframe, endTime).then(res => {
      this.klines = res.data.concat(this.klines);
      const start = this.klines[0][0];
      const end = start - 60000;
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
        const binanceKlines = this.mapResult();
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
  public getKlinesRecursiveFromDateUntilNow(symbol: string, startTime: number, timeframe: string, resolve: Function, reject: Function) {
    this.getKlines(symbol, timeframe, undefined, startTime).then(res => {
      this.klines = this.klines.concat(res.data);
      const end = this.klines[this.klines.length - 1][0];
      const start = end + 60000;
      const now = (new Date()).getTime();
      console.log('startTime: ' + startTime)
      console.log('now: ' + now)

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
        const binanceKlines = this.mapResult();
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
  public initKlinesDatabase(symbol: string, timeframe: string) {
    const startDate = new Date();
    const timespan = 1000 * 60 * 60 * 24 * 20;
    const startTime = startDate.getTime() - timespan;

    return new Promise((resolve, reject) => {
      this.database.findKlines(symbol, timeframe).then(res => {
        if (res.length === 0) {
          new Promise<Array<BinanceKline>>((resolve, reject) => {
            this.getKlinesRecursiveFromDateUntilNow(symbol, startTime, timeframe, resolve, reject);
          }).then(newKlines => {
            const insert = {
              symbol,
              timeframe,
              klines: newKlines
            };

            this.database.insert(insert);
            resolve('Database initialized with ' + newKlines.length + ' klines');
          }).catch(err => {
            this.handleError(err);
            reject(err);
          });
        } else {
          const dbKlines = res[0].klines;
          const lastKline = dbKlines[dbKlines.length - 1];

          new Promise<Array<BinanceKline>>((resolve, reject) => {
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

  private mapResult(): Array<BinanceKline> {
    return this.klines.map(k => {
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

  private createUrl(baseUrl: string, queryObj: any): string {
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
}