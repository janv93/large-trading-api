import axios from 'axios';
import crypto from 'crypto';
import btoa from 'btoa';
import { Kline } from '../../interfaces';
import Base from '../base';
import database from '../../data/database';

export default class Kucoin extends Base {
  private database = database;

  public async getKlines(symbol: string, timeframe: string, endTime?: number, startTime?: number): Promise<Kline[]> {
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

    this.log('GET ' + klineUrl, this);

    try {
      const response = await axios.get(klineUrl);
      const result = this.mapKlines(symbol, timeframe, response.data.data);
      return result;
    } catch (err) {
      this.handleError(err, symbol, this);
      return [];
    }
  }

  /**
   * get startTime to now timeframes
   */
  public async getKlinesFromStartUntilNow(symbol: string, startTime: number, endTime: number, timeframe: string): Promise<Kline[]> {
    let newStartTime = startTime;
    let newEndTime = endTime;
    let klines: Kline[] = [];

    while (true) {
      const res = await this.getKlines(symbol, timeframe, newEndTime, newStartTime);
      klines.push(...res);

      const end: number = klines[klines.length - 1].times.open;
      newStartTime = end + this.timeframeToMilliseconds(timeframe);
      newEndTime = newStartTime + this.timeframeToMilliseconds(timeframe) * 200;
      const now = Date.now();

      if (newStartTime >= now) {
        break;
      }
    }

    this.log(`Received total of ${klines.length} klines`, this);
    this.log(this.timestampsToDateRange(klines[0].times.open, klines[klines.length - 1].times.open), this);

    klines.sort((a, b) => a.times.open - b.times.open);
    return klines;
  }

  /**
   * initialize database with klines from predefined start date until now
   * allows to cache already requested klines and only request recent klines
   */
  public async initKlinesDatabase(symbol: string, timeframe: string): Promise<Kline[]> {
    const timespan = this.timeframeToMilliseconds(timeframe) * 1000 * 3;
    const startTime = this.roundTimeToNearestTimeframe(Date.now() - timespan, this.timeframeToMilliseconds(timeframe));
    const endTime = startTime + this.timeframeToMilliseconds(timeframe) * 200;
    const dbKlines = await this.database.getKlines(symbol, timeframe);

    if (!dbKlines?.length) {
      const newKlines = await this.getKlinesFromStartUntilNow(symbol, startTime, endTime, timeframe);
      await this.database.writeKlines(newKlines);
      this.log('Database initialized with ' + newKlines.length + ' klines', this);
      return newKlines;
    } else {
      const lastKline = dbKlines[dbKlines.length - 1];
      const endTime = lastKline.times.open + this.timeframeToMilliseconds(timeframe) * 200;
      const newKlines = await this.getKlinesFromStartUntilNow(symbol, lastKline.times.open, endTime, timeframe);
      newKlines.shift();    // remove first kline, since it's the same as last of dbKlines
      this.log(`Added ${newKlines.length} new klines to the database`, this);
      await this.database.writeKlines(newKlines);
      const mergedKlines = dbKlines.concat(newKlines);
      return mergedKlines;
    }
  }

  public async long(symbol, quantity, leverage): Promise<any> {
    const res = await this.createOrder(symbol, 'buy', quantity, leverage);
    this.log(res.data, this);
    this.log('LONG position opened', this);
    return res;
  }

  public async short(symbol, quantity, leverage): Promise<any> {
    const res = await this.createOrder(symbol, 'sell', quantity, leverage);
    this.log(res.data, this);
    this.log('SHORT position opened', this);
    return res;
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

    this.log('POST ' + url, this);
    return axios.post(url, query, options);
  }

  private createOrder(symbol: string, side: string, quantity: number, leverage: number): Promise<any> {
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

    this.log('POST ' + url, this);
    return axios.post(url, query, options);
  }

  private mapKlines(symbol: string, timeframe: string, klines: any[]): Kline[] {
    return klines.map(k => {
      return {
        symbol,
        timeframe,
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