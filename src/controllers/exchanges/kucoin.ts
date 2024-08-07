import axios from 'axios';
import crypto from 'crypto';
import btoa from 'btoa';
import { Kline, Timeframe } from '../../interfaces';
import Base from '../../base';
import database from '../../data/database';

export default class Kucoin extends Base {
  public async getKlines(symbol: string, timeframe: Timeframe, endTime?: number, startTime?: number): Promise<Kline[]> {
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

    this.log('GET ' + klineUrl);

    try {
      const response = await axios.get(klineUrl);
      const data = response.data.data;

      if (data) {
        const result = this.mapKlines(symbol, timeframe, response.data.data);
        return result;
      } else {
        return [];
      }
    } catch (err) {
      this.handleError(err, symbol);
      return [];
    }
  }

  /**
   * get startTime to now timeframes
   */
  public async getKlinesFromStartUntilNow(symbol: string, startTime: number, endTime: number, timeframe: Timeframe): Promise<Kline[]> {
    let newStartTime = startTime;
    let newEndTime = endTime;
    const klines: Kline[] = [];

    while (true) {
      const res = await this.getKlines(symbol, timeframe, newEndTime, newStartTime);

      if (res && res.length) {
        klines.push(...res);
        const end: number = klines[klines.length - 1].times.open;
        newStartTime = end + this.timeframeToMilliseconds(timeframe);
      } else {
        newStartTime = newStartTime + this.timeframeToMilliseconds(timeframe) * 200;
      }

      newEndTime = newStartTime + this.timeframeToMilliseconds(timeframe) * 200;
      const now = Date.now();

      if (newStartTime >= now) {
        break;
      }
    }

    const dateRange = this.timestampsToDateRange(klines[0].times.open, klines[klines.length - 1].times.open)
    this.log(`Received total of ${klines.length} klines: ${dateRange}`);

    klines.sort((a, b) => a.times.open - b.times.open);
    return klines;
  }

  /**
   * initialize database with klines from predefined start date until now
   * allows to cache already requested klines and only request recent klines
   */
  public async initKlinesDatabase(symbol: string, timeframe: Timeframe): Promise<Kline[]> {
    const startTime = this.calcStartTime(timeframe);
    const endTime = startTime + this.timeframeToMilliseconds(timeframe) * 200;
    const dbKlines = await database.getKlines(symbol, timeframe);

    if (!dbKlines?.length) {
      const newKlines = await this.getKlinesFromStartUntilNow(symbol, startTime, endTime, timeframe);

      if (newKlines.length) {
        await database.writeKlines(newKlines);
        this.log('Database initialized with ' + newKlines.length + ' klines');
      }

      return newKlines;
    } else {
      const lastKline = dbKlines[dbKlines.length - 1];
      const endTime = lastKline.times.open + this.timeframeToMilliseconds(timeframe) * 200;
      const newKlines = await this.getKlinesFromStartUntilNow(symbol, lastKline.times.open, endTime, timeframe);
      newKlines.shift();    // remove first kline, since it's the same as last of dbKlines
      this.log(`Added ${newKlines.length} new klines to the database`);
      await database.writeKlines(newKlines);
      const mergedKlines = dbKlines.concat(newKlines);
      return mergedKlines;
    }
  }

  public async long(symbol, quantity, leverage): Promise<any> {
    const res = await this.createOrder(symbol, 'buy', quantity, leverage);
    this.log(res.data);
    this.log('LONG position opened');
    return res;
  }

  public async short(symbol, quantity, leverage): Promise<any> {
    const res = await this.createOrder(symbol, 'sell', quantity, leverage);
    this.log(res.data);
    this.log('SHORT position opened');
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

    this.log('POST ' + url);
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

    this.log('POST ' + url);
    return axios.post(url, query, options);
  }

  private mapKlines(symbol: string, timeframe: Timeframe, klines: any[]): Kline[] {
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
        volume: Number(k[5]),
        algorithms: {}
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