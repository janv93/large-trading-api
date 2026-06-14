import axios from 'axios';
import crypto from 'crypto';
import btoa from 'btoa';
import { Bar, Exchange, Timeframe } from '@shared';
import Base from '../../base';
import { createUrl, createQuery, calcStartTime, timeframeToMinutes, timeframeToMilliseconds, timestampsToDateRange, cutOngoingBar } from '@shared';
import database from '../../data/database';

export default class Kucoin extends Base {
  readonly exchange = Exchange.Kucoin;

  public async isValidSymbol(symbol: string): Promise<boolean> {
    try {
      const response = await axios.get(`https://api-futures.kucoin.com/api/v1/contracts/${symbol}`);
      return response.data?.code === '200000' && !!response.data?.data;
    } catch {
      return false;
    }
  }

  public async getBars(symbol: string, timeframe: Timeframe, endTime?: number, startTime?: number): Promise<Bar[]> {
    const baseUrl = 'https://api-futures.kucoin.com/api/v1/kline/query';

    const query = {
      granularity: timeframeToMinutes(timeframe),
      symbol: symbol
    };

    if (endTime && endTime > 0) {
      query['to'] = endTime;
    }

    if (startTime && startTime > 0) {
      query['from'] = startTime;
    }

    const barUrl = createUrl(baseUrl, query);

    this.log('GET ' + barUrl);

    try {
      const response = await axios.get(barUrl);
      const data = response.data.data;

      if (data?.length) {
        const result = this.mapBars(symbol, timeframe, response.data.data);
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
  public async getBarsFromStartUntilNow(symbol: string, startTime: number, endTime: number, timeframe: Timeframe): Promise<Bar[]> {
    const valid = await this.isValidSymbol(symbol);
    if (!valid) {
      this.log(`Invalid symbol ${symbol}`);
      return [];
    }

    let newStartTime = startTime;
    let newEndTime = endTime;
    const bars: Bar[] = [];

    while (true) {
      const res: Bar[] = await this.getBars(symbol, timeframe, newEndTime, newStartTime);

      if (res?.length) {
        bars.push(...res);
        const end: number = bars[bars.length - 1].times.open;
        newStartTime = end + timeframeToMilliseconds(timeframe);
      } else {
        newStartTime = newStartTime + timeframeToMilliseconds(timeframe) * 200;
      }

      newEndTime = newStartTime + timeframeToMilliseconds(timeframe) * 200;
      const now: number = Date.now();

      if (newStartTime >= now) {
        break;
      }
    }

    if (!bars.length) return [];
    const dateRange: string = timestampsToDateRange(bars[0].times.open, bars[bars.length - 1].times.open)
    this.log(`Received total of ${bars.length} bars: ${dateRange}`);

    bars.sort((a, b) => a.times.open - b.times.open);
    return cutOngoingBar(bars);
  }

  /**
   * initialize database with bars from predefined start date until now
   * allows to cache already requested bars and only request recent bars
   */
  public async initBarsDatabase(symbol: string, timeframe: Timeframe): Promise<Bar[]> {
    const startTime = calcStartTime(timeframe);
    const endTime = startTime + timeframeToMilliseconds(timeframe) * 200;
    const dbBars = await database.getBars(symbol, timeframe, this.exchange);

    if (!dbBars?.length) {
      const newBars = await this.getBarsFromStartUntilNow(symbol, startTime, endTime, timeframe);

      if (newBars.length) {
        await database.writeBars(newBars);
        this.log('Database initialized with ' + newBars.length + ' bars');
      }

      return newBars;
    } else {
      const lastBar = dbBars[dbBars.length - 1];
      const endTime = lastBar.times.open + timeframeToMilliseconds(timeframe) * 200;
      const newBars = await this.getBarsFromStartUntilNow(symbol, lastBar.times.open, endTime, timeframe);
      newBars.shift();    // remove first bar, since it's the same as last of dbBars
      this.log(`Added ${newBars.length} new bars to the database`);
      await database.writeBars(newBars);
      const mergedBars = dbBars.concat(newBars);
      return mergedBars;
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
    const kcApiSignContent = now + 'POST' + '/api/v1/orders' + createQuery(query) + JSON.stringify(query)
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

    const url = createUrl('https://api-futures.kucoin.com/api/v1/orders', query);

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
    const kcApiSignContent = now + 'POST' + '/api/v1/orders' + createQuery(query) + JSON.stringify(query)
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

    const url = createUrl('https://api-futures.kucoin.com/api/v1/orders', query);

    this.log('POST ' + url);
    return axios.post(url, query, options);
  }

  private mapBars(symbol: string, timeframe: Timeframe, bars: any[]): Bar[] {
    return bars.map(k => {
      return {
        symbol,
        exchange: this.exchange,
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