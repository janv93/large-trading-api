import axios from 'axios';
import crypto from 'crypto';
import { Kline } from '../../interfaces';
import BaseController from '../base-controller';
import Database from '../../data/db';

export default class AlpacaController extends BaseController {
  private database: Database = new Database();
  private klines: any[] = [];

  public getKlines(symbol: string, timeframe: string, startTime?: number, pageToken?: string): Promise<any> {
    const baseUrl = 'https://data.alpaca.markets/v2/stocks/' + symbol + '/bars';

    const query = {
      timeframe: timeframe ? this.mapTimeframe(timeframe) : '1Minute',
      end: new Date(Date.now() - 15000000).toISOString(),
      adjustment: 'split'
    };

    if (startTime) {
      query['start'] = new Date(startTime).toISOString();
    }

    if (pageToken) {
      query['page_token'] = pageToken;
    }

    const klineUrl = this.createUrl(baseUrl, query);

    const options = {
      headers: {
        'APCA-API-KEY-ID': process.env.alpaca_api_key,
        'APCA-API-SECRET-KEY': process.env.alpaca_api_secret
      }
    };

    console.log('GET ' + klineUrl);
    return axios.get(klineUrl, options);
  }

  public getKlinesMultiple(symbol: string, times: number, timeframe: string): Promise<any> {
    const start = Date.now() - this.timeframeToMilliseconds(timeframe) * 1000 * times;

    return new Promise((resolve, reject) => {
      this.getKlinesRecursive(symbol, start, timeframe, resolve, reject);
    });
  }

  /**
   * get klines from startTime until now
   */
  public getKlinesRecursive(symbol: string, startTime: number, timeframe: string, resolve: Function, reject: Function, pageToken?: string): void {
    this.getKlines(symbol, timeframe, startTime, pageToken).then(res => {
      this.klines = this.klines.concat(res.data.bars);
      const nextPageToken = res.data.next_page_token;

      if (nextPageToken) {
        this.getKlinesRecursive(symbol, startTime, timeframe, resolve, reject, nextPageToken);
      } else {
        console.log();
        console.log('Received total of ' + this.klines.length + ' klines');
        const firstDate = new Date(this.klines[0].t);
        console.log('First date: ' + firstDate);
        const lastDate = new Date(this.klines[this.klines.length - 1].t);
        console.log('Last date: ' + lastDate);
        console.log();
        const alpacaKlines = this.mapResult(this.klines);
        resolve(alpacaKlines);
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
    const timespan = this.timeframeToMilliseconds(timeframe) * 1000 * 200;
    const startTime = Date.now() - timespan;

    return new Promise((resolve, reject) => {
      this.database.findKlines(symbol, timeframe).then(res => {
        if (res.length === 0) {  // not in database yet
          new Promise<Kline[]>((resolve, reject) => {
            this.getKlinesRecursive(symbol, startTime, timeframe, resolve, reject);
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
        } else {  // already in database
          const dbKlines = res[0].klines;
          const lastKline = dbKlines[dbKlines.length - 1];
          const newStart = lastKline.times.open;

          new Promise<Kline[]>((resolve, reject) => {
            this.getKlinesRecursive(symbol, newStart, timeframe, resolve, reject);
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

  public mapResult(klines: any[]): Kline[] {
    return klines.map(k => {
      return {
        times: {
          open: (new Date(k.t)).getTime()
        },
        prices: {
          open: k.o,
          high: k.h,
          low: k.l,
          close: k.c
        },
        volume: k.v,
        numberOfTrades: k.n
      };
    });
  }

  private mapTimeframe(timeframe: string): string {
    const amount = timeframe.replace(/\D/g,'');
    const unit = timeframe.replace(/[0-9]/g, '');

    switch(unit) {
      case 'm': return amount + 'Minute';
      case 'h': return amount + 'Hour';
      case 'd': return amount + 'Day';
      default: return 'incorrect timeframe';
    }
  }
}