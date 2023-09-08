import axios from 'axios';
import { AlpacaResponse, Kline } from '../../interfaces';
import Base from '../base';
import database from '../../data/database';

export default class Alpaca extends Base {
  private database = database;
  private klines: Kline[] = [];

  public async getKlines(symbol: string, timeframe: string, startTime?: number, pageToken?: string): Promise<AlpacaResponse> {
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

    try {
      const res = await axios.get(klineUrl, options);
      const klines = this.mapKlines(symbol, timeframe, res.data.bars);
      return { nextPageToken: res.data.next_page_token, klines };
    } catch (err) {
      this.handleError(err);
      return { nextPageToken: '', klines: [] };
    }
  }

  /**
   * get last times * 1000 timeframes
   */
  public async getKlinesMultiple(symbol: string, times: number, timeframe: string): Promise<Kline[]> {
    const start = Date.now() - this.timeframeToMilliseconds(timeframe) * 1000 * times;
    return this.getKlinesRecursiveFromStartUntilNow(symbol, start, timeframe);
  }

  /**
   * initialize database with klines from predefined start date until now
   * allows to cache already requested klines and only request recent klines
   */
  public async initKlinesDatabase(symbol: string, timeframe: string): Promise<Kline[]> {
    const startTime = this.calcStartTime(timeframe);

    try {
      const res = await this.database.getKlines(symbol, timeframe);

      if (!res || !res.length) {  // not in database yet
        const newKlines = await this.getKlinesRecursiveFromStartUntilNow(symbol, startTime, timeframe);
        await this.database.writeKlines(newKlines);
        console.log('Database initialized with ' + newKlines.length + ' klines');
        console.log();
        return newKlines;
      } else {  // already in database
        const dbKlines = res;
        const lastKline = dbKlines[dbKlines.length - 1];
        const newStart = lastKline.times.open;

        const newKlines = await this.getKlinesRecursiveFromStartUntilNow(symbol, newStart, timeframe);
        newKlines.shift();    // remove first kline, since it's the same as last of dbKlines
        console.log('Added ' + newKlines.length + ' new klines to database');
        console.log();
        await this.database.writeKlines(newKlines);
        const mergedKlines = dbKlines.concat(newKlines);
        return mergedKlines;
      }
    } catch (err) {
      this.handleError(err);
      throw err;
    }
  }

  /**
   * get klines from startTime until now
   */
  private async getKlinesRecursiveFromStartUntilNow(symbol: string, startTime: number, timeframe: string, pageToken?: string): Promise<Kline[]> {
    const res = await this.getKlines(symbol, timeframe, startTime, pageToken);
    this.klines.push(...res.klines);
    const nextPageToken = res.nextPageToken;

    if (nextPageToken) {
      return this.getKlinesRecursiveFromStartUntilNow(symbol, startTime, timeframe, nextPageToken);
    } else {
      console.log();
      console.log('Received total of ' + this.klines.length + ' klines');
      console.log(this.timestampsToDateRange(this.klines[0].times.open, this.klines[this.klines.length - 1].times.open));
      console.log();
      const finalKlines = [...this.klines];
      this.klines = [];
      return finalKlines;
    }
  }

  public async getAssets(): Promise<string[]> {
    let res;

    const options = {
      headers: {
        'APCA-API-KEY-ID': process.env.alpaca_api_key,
        'APCA-API-SECRET-KEY': process.env.alpaca_api_secret
      }
    };

    res = await axios.get('https://api.alpaca.markets/v2/assets', options);
    return res.data.map(s => s.symbol);
  }

  private mapKlines(symbol: string, timeframe: string, klines: any): Kline[] {
    return klines.map(k => {
      return {
        symbol,
        timeframe,
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
    const amount = timeframe.replace(/\D/g, '');
    const unit = timeframe.replace(/[0-9]/g, '');

    switch (unit) {
      case 'm': return amount + 'Minute';
      case 'h': return amount + 'Hour';
      case 'd': return amount + 'Day';
      case 'w': return amount + 'Week';
      default: return 'incorrect timeframe';
    }
  }
}