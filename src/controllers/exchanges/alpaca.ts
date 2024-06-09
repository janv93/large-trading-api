import fs from 'fs';
import axios from 'axios';
import { AlpacaResponse, Kline, Timeframe } from '../../interfaces';
import Base from '../base';
import database from '../../data/database';

class Alpaca extends Base {
  private rateLimitPerMinute = 190;
  private requestsSentThisMinute = 0;

  public async getKlines(symbol: string, timeframe: Timeframe, startTime?: number, pageToken?: string): Promise<AlpacaResponse> {
    const baseUrl = 'https://data.alpaca.markets/v2/stocks/' + symbol + '/bars';

    const query = {
      timeframe: timeframe ? this.mapTimeframe(timeframe) : '1Min',
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

    this.log('GET ' + klineUrl, this);

    try {
      await this.waitIfRateLimitReached();
      const res = await axios.get(klineUrl, options);
      const klines = this.mapKlines(symbol, timeframe, res.data.bars);
      return { nextPageToken: res.data.next_page_token, klines };
    } catch (err) {
      this.handleError(err, symbol, this);
      return { nextPageToken: '', klines: [] };
    }
  }

  /**
   * initialize database with klines from predefined start date until now
   * allows to cache already requested klines and only request recent klines
   */
  public async initKlinesDatabase(symbol: string, timeframe: Timeframe): Promise<Kline[]> {
    const startTime: number = this.calcStartTime(timeframe);
    const dbKlines: Kline[] = await database.getKlines(symbol, timeframe);

    // not in database yet
    if (!dbKlines || !dbKlines.length) {
      const newKlines: Kline[] = await this.getKlinesFromStartUntilNow(symbol, startTime, timeframe);

      if (newKlines.length) {
        await database.writeKlines(newKlines);
        this.log(`${newKlines.length} ${symbol} klines initialized in database`, this);
      }

      return newKlines;
    }

    // already in database
    const lastKline: Kline = dbKlines[dbKlines.length - 1];
    const newStart: number = lastKline.times.open;

    if (this.klineOutdated(timeframe, newStart)) {
      const newKlines: Kline[] = await this.getKlinesFromStartUntilNow(symbol, newStart, timeframe);
      newKlines.shift();    // remove first kline, since it's the same as last of dbKlines
      this.log(`${newKlines.length} new ${symbol} klines added to database`, this);
      await database.writeKlines(newKlines);
      const mergedKlines: Kline[] = dbKlines.concat(newKlines);
      return mergedKlines;
    } else {
      this.log(`${symbol} already up to date`, this);
      return dbKlines;
    }
  }

  /**
   * get klines from startTime until now
   */
  private async getKlinesFromStartUntilNow(symbol: string, startTime: number, timeframe: Timeframe): Promise<Kline[]> {
    let klines: Kline[] = [];
    let pageToken: string | undefined;

    while (true) {
      const res = await this.getKlines(symbol, timeframe, startTime, pageToken);
      klines.push(...res.klines);
      pageToken = res.nextPageToken;

      if (!pageToken) {
        break;
      }
    }

    const dateRange = this.timestampsToDateRange(klines[0]?.times.open, klines[klines.length - 1]?.times.open)
    this.log(`${klines.length} ${symbol} klines received - ${dateRange}`, this);

    klines.sort((a, b) => a.times.open - b.times.open);
    return klines;
  }

  public async getAssets(): Promise<string[]> {
    const cachedFile = 'src/controllers/exchanges/alpaca-all-tickers.json';

    if (fs.existsSync(cachedFile)) {
      const cachedData = JSON.parse(fs.readFileSync(cachedFile, 'utf8'));
      const currentTime = new Date().getTime();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;

      // If cache is newer than one week, return it
      if (currentTime - cachedData.timestamp < oneWeek) {
        return cachedData.symbols;
      }
    }

    const options = {
      headers: {
        'APCA-API-KEY-ID': process.env.alpaca_api_key,
        'APCA-API-SECRET-KEY': process.env.alpaca_api_secret
      }
    };

    const res = await axios.get('https://api.alpaca.markets/v2/assets', options);
    const symbols = res.data.map(s => s.symbol);

    const cacheData = {
      timestamp: new Date().getTime(),
      symbols: symbols,
    };

    fs.writeFileSync(cachedFile, JSON.stringify(cacheData));
    return symbols;
  }

  private mapKlines(symbol: string, timeframe: Timeframe, klines: any): Kline[] {
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
        numberOfTrades: k.n,
        algorithms: {}
      };
    });
  }

  private mapTimeframe(timeframe: Timeframe): string {
    const amount = timeframe.replace(/\D/g, '');
    const unit = timeframe.replace(/[0-9]/g, '');

    switch (unit) {
      case 'm': return amount + 'Min';
      case 'h': return amount + 'Hour';
      case 'd': return amount + 'Day';
      case 'w': return amount + 'Week';
      default: return 'incorrect timeframe';
    }
  }

  private async waitIfRateLimitReached(): Promise<void> {
    this.requestsSentThisMinute++;

    // wait at rate limit
    if (this.requestsSentThisMinute >= this.rateLimitPerMinute) {
      this.log('Rate limit reached, waiting', this);
      await this.sleep(60000);
      this.requestsSentThisMinute = 0;
    }
  }
}

export default new Alpaca();