import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { AlpacaResponse, Kline, Timeframe } from '../../interfaces';
import Base from '../../base';
import database from '../../data/database';

class Alpaca extends Base {
  private baseUrls = {
    baseUrlDatav1: 'https://data.alpaca.markets/v1beta1',
    baseUrlDatav2: 'https://api.alpaca.markets/v2',
    baseUrlv2: 'https://data.alpaca.markets/v2'
  };

  private rateLimitPerMinute = 190;
  private requestsSentThisMinute = 0;

  public async getKlines(symbol: string, timeframe: Timeframe, startTime?: number, pageToken?: string): Promise<AlpacaResponse> {
    const url = `${this.baseUrls.baseUrlv2}/stocks/${symbol}/bars`;

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

    const finalUrl: string = this.createUrl(url, query);
    this.log('GET ' + finalUrl);

    try {
      await this.waitIfRateLimitReached();
      const options: AxiosRequestConfig = this.getRequestOptions();
      const res: AxiosResponse = await axios.get(finalUrl, options);
      const klines = this.mapKlines(symbol, timeframe, res.data.bars);
      return { nextPageToken: res.data.next_page_token, klines };
    } catch (err) {
      this.handleError(err, symbol);
      return { nextPageToken: '', klines: [] };
    }
  }

  /**
   * initialize database with klines from predefined start date until now
   * allows to cache already requested klines and only request recent klines
   */
  public async initKlinesDatabase(symbol: string, timeframe: Timeframe): Promise<Kline[]> {
    const startTime: number = this.calcStartTime(timeframe);
    let dbKlines: Kline[] = await database.getKlines(symbol, timeframe);

    // not in database yet
    if (!dbKlines || !dbKlines.length) {
      const newKlines: Kline[] = await this.getKlinesFromStartUntilNow(symbol, startTime, timeframe);

      if (newKlines.length) {
        await database.writeKlines(newKlines);
        this.log(`${newKlines.length} ${symbol} klines initialized in database`);
      }

      return newKlines;
    }

    // already in database
    const lastKline: Kline = dbKlines[dbKlines.length - 1];
    const lastKlineTime: number = lastKline.times.open;

    if (this.klineOutdated(timeframe, lastKlineTime)) {
      const hasNewStockSplits: boolean = (await this.getStockSplitSymbols([symbol], lastKlineTime)).length > 0;

      if (hasNewStockSplits) {
        await database.deleteAllKlinesWithSymbol(symbol);
        dbKlines = [];
      }
  
      const newStart: number = hasNewStockSplits ? startTime : lastKlineTime;
      const newKlines: Kline[] = await this.getKlinesFromStartUntilNow(symbol, newStart, timeframe);
      newKlines.shift();    // remove first kline, since it's the same as last of dbKlines
      this.log(`${newKlines.length} new ${symbol} klines added to database`);
      await database.writeKlines(newKlines);
      const mergedKlines: Kline[] = dbKlines.concat(newKlines);
      return mergedKlines;
    } else {
      this.log(`${symbol} already up to date`);
      return dbKlines;
    }
  }

  // get {top} most active stocks by volume
  public async getMostActiveStocks(top: number): Promise<string[]> {
    this.log(`Get ${top} most active stocks`);
    const dbSymbols: string[] | null = await database.getAlpacaSymbolsIfUpToDate();
    if (dbSymbols && dbSymbols.length >= top) return dbSymbols.slice(0, top);
    const url = `${this.baseUrls.baseUrlDatav1}/screener/stocks/most-actives`;
    const query = { top };
    const finalUrl: string = this.createUrl(url, query);
    const options: AxiosRequestConfig = this.getRequestOptions();
    const res: AxiosResponse = await axios.get(finalUrl, options);
    const mostActiveSymbols: string[] = res.data.most_actives.map(m => m.symbol);
    await database.updateAlpacaSymbols(mostActiveSymbols);
    return mostActiveSymbols;
  }

  // 1-time cleanup of database, deletes all klines of symbols that had stock splits so that future klines use the same price multiplier as past klines
  public async deleteStockSplitSymbols(): Promise<void> {
    const hadStockSplitCleanup: boolean = await database.getHadStockSplitCleanup();
    if (hadStockSplitCleanup) return;
    this.log(`Delete all database symbols with stock splits`);
    const allSymbols: string[] = await database.getAllUniqueSymbols();
    const stockSymbols: string[] = allSymbols.filter((symbol: string) => !symbol.includes('USDT') && !symbol.includes('BUSD'));
    const stockSplitSymbols: string[] = await this.getStockSplitSymbols(stockSymbols);

    if (stockSplitSymbols) {
      await Promise.all(stockSplitSymbols.map((symbol: string) => database.deleteAllKlinesWithSymbol(symbol)));
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

    const finalUrl: string = this.createUrl(url, query);
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
   * get klines from startTime until now
   */
  private async getKlinesFromStartUntilNow(symbol: string, startTime: number, timeframe: Timeframe): Promise<Kline[]> {
    const klines: Kline[] = [];
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
    this.log(`${klines.length} ${symbol} klines received - ${dateRange}`);

    klines.sort((a, b) => a.times.open - b.times.open);
    return klines;
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
      this.log('Rate limit reached, waiting');
      await this.sleep(60000);
      this.requestsSentThisMinute = 0;
    }
  }
}

export default new Alpaca();