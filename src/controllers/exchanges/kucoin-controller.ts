import axios from 'axios';
import crypto from 'crypto';
import btoa from 'btoa';
import { BinanceKucoinKline } from '../../interfaces';
import BaseController from '../base-controller';
import Database from '../../data/db';

export default class KucoinController extends BaseController {
  private database: Database = new Database();
  private klines = [];

  constructor() {
    super();
  }

  public getKlines(symbol: string, timeframe: string, endTime?: number, startTime?: number): Promise<any> {
    const baseUrl = 'https://api-futures.kucoin.com/api/v1/kline/query';

    const query = {
      granularity: this.timeframeToMinutes(timeframe),
      symbol: symbol
    };

    if (endTime && endTime > 0) {
      query['to'] = endTime;
    }

    if (startTime && startTime > 0) {
      query['from'] = startTime;
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
      this.klines = res.data.data.concat(this.klines);
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
  public getKlinesRecursiveFromDateUntilNow(symbol: string, startTime: number, endTime: number, timeframe: string, resolve: Function, reject: Function) {
    this.getKlines(symbol, timeframe, endTime, startTime).then(res => {
      this.klines = this.klines.concat(res.data.data);
      const end: number = this.klines[this.klines.length - 1][0];
      const newStartTime: number = end + this.timeframeToMilliseconds(timeframe);
      const newEndTime: number = newStartTime + this.timeframeToMilliseconds(timeframe) * 200;
      const now = (new Date()).getTime();

      if (newStartTime < now) {
        this.getKlinesRecursiveFromDateUntilNow(symbol, newStartTime, newEndTime, timeframe, resolve, reject);
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
  public initKlinesDatabase(symbol: string, timeframe: string) {
    const startDate = new Date();
    const timespan = this.timeframeToMilliseconds(timeframe) * 1000 * 3;
    const startTime = this.roundTimeToNearestTimeframe(startDate.getTime() - timespan, this.timeframeToMilliseconds(timeframe));
    const endTime = startTime + this.timeframeToMilliseconds(timeframe) * 200;

    return new Promise((resolve, reject) => {
      this.database.findKlines(symbol, timeframe).then(res => {
        if (res.length === 0) {
          new Promise<Array<BinanceKucoinKline>>((resolve, reject) => {
            this.getKlinesRecursiveFromDateUntilNow(symbol, startTime, endTime, timeframe, resolve, reject);
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
          const endTime = lastKline.times.open + this.timeframeToMilliseconds(timeframe) * 200;

          new Promise<Array<BinanceKucoinKline>>((resolve, reject) => {
            this.getKlinesRecursiveFromDateUntilNow(symbol, lastKline.times.open, endTime, timeframe, resolve, reject);
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

  public long(symbol, quantity, leverage): Promise<any> {
    return this.createOrder(symbol, 'buy', quantity, leverage).then((res) => {
      console.log(res.data);
      console.log('LONG position opened');
    }).catch(err => this.handleError(err));
  }

  public short(symbol, quantity, leverage): Promise<any> {
    return this.createOrder(symbol, 'sell', quantity, leverage).then((res) => {
      console.log(res.data);
      console.log('SHORT position opened');
    }).catch(err => this.handleError(err));
  }

  public createOrder(symbol: string, side: string, quantity: number, leverage: number): Promise<any> {
    const mappedSymbol = this.mapSymbol(symbol);
    const now = Date.now();

    const query = {
      symbol: mappedSymbol,
      side,
      leverage,
      type: 'market',
      size: this.mapKcLotSize(mappedSymbol, quantity),
      clientOid: now
    };

    const kcApiPassphrase = btoa(this.createHmac(process.env.kucoin_api_passphrase));
    const kcApiSignContent = now + 'POST' + '/api/v1/orders' + this.createQuery(query) + JSON.stringify(query)
    const kcApiSign = btoa(this.createHmac(kcApiSignContent));

    const options = {
      headers: {
        'KC-API-KEY': process.env.kucoin_api_key,
        'KC-API-SECRET': process.env.kucoin_api_secret,
        'KC-API-SIGN': kcApiSign,
        'KC-API-TIMESTAMP': now,
        'KC-API-PASSPHRASE': kcApiPassphrase,
        'KC-API-KEY-VERSION': 2
      }
    };

    const url = this.createUrl('https://api-futures.kucoin.com/api/v1/orders', query);

    console.log('POST ' + url);
    return axios.post(url, query, options);
  }

  public closeOrder(symbol: string): Promise<any> {
    const mappedSymbol = this.mapSymbol(symbol);
    const now = Date.now();

    const query = {
      symbol: mappedSymbol,
      type: 'market',
      clientOid: now,
      closeOrder: true
    };

    const kcApiPassphrase = btoa(this.createHmac(process.env.kucoin_api_passphrase));
    const kcApiSignContent = now + 'POST' + '/api/v1/orders' + this.createQuery(query) + JSON.stringify(query)
    const kcApiSign = btoa(this.createHmac(kcApiSignContent));

    const options = {
      headers: {
        'KC-API-KEY': process.env.kucoin_api_key,
        'KC-API-SECRET': process.env.kucoin_api_secret,
        'KC-API-SIGN': kcApiSign,
        'KC-API-TIMESTAMP': now,
        'KC-API-PASSPHRASE': kcApiPassphrase,
        'KC-API-KEY-VERSION': 2
      }
    };

    const url = this.createUrl('https://api-futures.kucoin.com/api/v1/orders', query);

    console.log('POST ' + url);
    return axios.post(url, query, options);
  }

  public mapResult(klines: Array<any>): Array<BinanceKucoinKline> {
    return klines.map(k => {
      return {
        times: {
          open: k[0]
        },
        prices: {
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4])
        },
        volume: Number(k[5])
      };
    });
  }

  private createHmac(query): Buffer {
    return crypto.createHmac('sha256', process.env.kucoin_api_secret as any).update(query).digest();
  }

  /**
   * returns lot size for quantity
   */
  private mapKcLotSize(symbol: string, quantity: number): number {
    const lotSizes = {
      XBTUSDTM: 0.001,
      ETHUSDTM: 0.01,
    };

    return quantity / lotSizes[symbol];
  }

  private mapSymbol(symbol: string): string {
    switch (symbol) {
      case 'BTCUSDT': return 'XBTUSDTM';
      case 'ETHUSDT': return 'ETHUSDTM';
      default: return '';
    }
  }

}