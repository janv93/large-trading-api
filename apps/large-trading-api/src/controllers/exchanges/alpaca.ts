import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { AlpacaResponse, Bar, Timeframe } from '@shared';
import Base from '../../base';
import { createUrl, calcStartTime, isBarOutdated, timestampsToDateRange, sleep } from '@shared';
import database from '../../data/database';

class Alpaca extends Base {
  private baseUrls = {
    baseUrlDatav1: 'https://data.alpaca.markets/v1beta1',
    baseUrlDatav2: 'https://api.alpaca.markets/v2',
    baseUrlv2: 'https://data.alpaca.markets/v2'
  };

  private rateLimitPerMinute = 190;
  private requestsSentThisMinute = 0;
  private lastFetchTime: Map<string, number> = new Map();

  public async getBars(symbol: string, timeframe: Timeframe, startTime?: number, pageToken?: string): Promise<AlpacaResponse> {
    const url = `${this.baseUrls.baseUrlv2}/stocks/${symbol}/bars`;

    const query = {
      timeframe: this.mapTimeframe(timeframe),
      end: new Date(Date.now() - 15000000).toISOString(),
      adjustment: 'split'
    };

    if (startTime) {
      query['start'] = new Date(startTime).toISOString();
    }

    if (pageToken) {
      query['page_token'] = pageToken;
    }

    const finalUrl: string = createUrl(url, query);
    this.log('GET ' + finalUrl);

    try {
      await this.waitIfRateLimitReached();
      const options: AxiosRequestConfig = this.getRequestOptions();
      const res: AxiosResponse = await axios.get(finalUrl, options);
      if (!res.data?.bars) return { nextPageToken: '', bars: [] };
      const bars = this.mapBars(symbol, timeframe, res.data.bars);
      return { nextPageToken: res.data.next_page_token, bars };
    } catch (err) {
      this.handleError(err, symbol);
      return { nextPageToken: '', bars: [] };
    }
  }

  /**
   * initialize database with bars from predefined start date until now
   * allows to cache already requested bars and only request recent bars
   */
  public async initBarsDatabase(symbol: string, timeframe: Timeframe): Promise<Bar[]> {
    const startTime: number = calcStartTime(timeframe);
    let dbBars: Bar[] = await database.getBars(symbol, timeframe);

    // not in database yet
    if (!dbBars || !dbBars.length) {
      const newBars: Bar[] = await this.getBarsFromStartUntilNow(symbol, startTime, timeframe);

      if (newBars.length) {
        await database.writeBars(newBars);
        this.log(`${newBars.length} ${symbol} bars initialized in database`);
      }

      return newBars;
    }

    // already in database
    const lastBar: Bar = dbBars[dbBars.length - 1];
    const lastBarTime: number = lastBar.times.open;

    const cacheKey = `${symbol}_${timeframe}`;
    const lastFetch: number | undefined = this.lastFetchTime.get(cacheKey) ?? await database.getBarFetchTime(symbol, timeframe);

    if (isBarOutdated(timeframe, lastBarTime, lastFetch)) {
      const hasNewStockSplits: boolean = (await this.getStockSplitSymbols([symbol], lastBarTime)).length > 0;

      if (hasNewStockSplits) {
        await database.deleteAllBarsWithSymbol(symbol);
        dbBars = [];
      }

      const newStart: number = hasNewStockSplits ? startTime : lastBarTime;
      const newBars: Bar[] = await this.getBarsFromStartUntilNow(symbol, newStart, timeframe);
      newBars.shift();    // remove first bar, since it's the same as last of dbBars
      this.log(`${newBars.length} new ${symbol} bars added to database`);
      this.lastFetchTime.set(cacheKey, Date.now());
      await database.updateBarFetchTime(symbol, timeframe);
      await database.writeBars(newBars);
      const mergedBars: Bar[] = dbBars.concat(newBars);
      return mergedBars;
    } else {
      this.log(`${symbol} already up to date`);
      return dbBars;
    }
  }

  // get {top} most active stocks by volume
  public async getMostActiveStocks(top: number): Promise<string[]> {
    this.log(`Get ${top} most active stocks`);
    const dbSymbols: string[] | null = await database.getAlpacaSymbolsIfUpToDate();
    if (dbSymbols && dbSymbols.length >= top) return dbSymbols.slice(0, top);
    const url = `${this.baseUrls.baseUrlDatav1}/screener/stocks/most-actives`;
    const query = { top };
    const finalUrl: string = createUrl(url, query);
    const options: AxiosRequestConfig = this.getRequestOptions();
    const res: AxiosResponse = await axios.get(finalUrl, options);
    const mostActiveSymbols: string[] = res.data.most_actives.map(m => m.symbol);
    await database.updateAlpacaSymbols(mostActiveSymbols);
    return mostActiveSymbols;
  }

  // 1-time cleanup of database, deletes all bars of symbols that had stock splits so that future bars use the same price multiplier as past bars
  public async deleteStockSplitSymbols(): Promise<void> {
    const hadStockSplitCleanup: boolean = await database.getHadStockSplitCleanup();
    if (hadStockSplitCleanup) return;
    this.log(`Delete all database symbols with stock splits`);
    const allSymbols: string[] = await database.getAllUniqueSymbols();
    const stockSymbols: string[] = allSymbols.filter((symbol: string) => !symbol.includes('USDT') && !symbol.includes('BUSD'));
    const stockSplitSymbols: string[] = await this.getStockSplitSymbols(stockSymbols);

    if (stockSplitSymbols) {
      await Promise.all(stockSplitSymbols.map((symbol: string) => database.deleteAllBarsWithSymbol(symbol)));
      await database.setHadStockSplitCleanup();
    }
  }

  // return all of the {symbols} that had a stock split
  private async getStockSplitSymbols(symbols: string[], startTime?: number): Promise<string[]> {
    this.log(`Get stock splits for ${symbols}`);
    const url = `${this.baseUrls.baseUrlDatav1}/corporate-actions`;
    const start: string = startTime ? new Date(startTime).toISOString().split('T')[0] : '2000-01-01';

    const query = {
      symbols: symbols.join(','),
      start,
      types: 'forward_split,reverse_split',
      limit: 1000
    };

    const finalUrl: string = createUrl(url, query);
    const options: AxiosRequestConfig = this.getRequestOptions();
    const res: AxiosResponse = await axios.get(finalUrl, options);
    const allSplits: any[] = [...(res.data.corporate_actions.forward_splits || []), ...(res.data.corporate_actions.reverse_splits || [])];
    const symbolsWithSplits: string[] = allSplits.map(split => split.symbol);
    const uniqueSymbolsWithSplits: string[] = Array.from(new Set(symbolsWithSplits));
    if (uniqueSymbolsWithSplits.length) this.log(`Found stock splits for ${uniqueSymbolsWithSplits}`); else this.log(`No stock splits for ${symbols}`);
    return uniqueSymbolsWithSplits;
  }

  private getRequestOptions(): AxiosRequestConfig {
    return {
      headers: {
        'APCA-API-KEY-ID': process.env.alpaca_api_key,
        'APCA-API-SECRET-KEY': process.env.alpaca_api_secret
      }
    };
  }

  /**
   * get bars from startTime until now
   */
  private async getBarsFromStartUntilNow(symbol: string, startTime: number, timeframe: Timeframe): Promise<Bar[]> {
    const bars: Bar[] = [];
    let pageToken: string | undefined;

    while (true) {
      const res = await this.getBars(symbol, timeframe, startTime, pageToken);
      bars.push(...res.bars);
      pageToken = res.nextPageToken;

      if (!pageToken) {
        break;
      }
    }

    const dateRange = timestampsToDateRange(bars[0]?.times.open, bars[bars.length - 1]?.times.open)
    this.log(`${bars.length} ${symbol} bars received - ${dateRange}`);

    bars.sort((a, b) => a.times.open - b.times.open);
    return bars;
  }

  private mapBars(symbol: string, timeframe: Timeframe, bars: any): Bar[] {
    return bars.map(k => {
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
      default: throw `Invalid timeframe ${timeframe}`;
    }
  }

  private async waitIfRateLimitReached(): Promise<void> {
    this.requestsSentThisMinute++;

    // wait at rate limit
    if (this.requestsSentThisMinute >= this.rateLimitPerMinute) {
      this.log('Rate limit reached, waiting');
      await sleep(60000);
      this.requestsSentThisMinute = 0;
    }
  }
}

export default new Alpaca();