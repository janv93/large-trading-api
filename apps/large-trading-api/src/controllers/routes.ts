import Base from '../base';
import { Algorithm, Exchange, Kline, Timeframe } from '@shared';
import alpaca from './exchanges/alpaca';
import binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Backtester from './algorithms/backtesting/backtester/backtester';
import Indicators from './technical-analysis/indicators';
import Coinmarketcap from './other-apis/coinmarketcap';
import { Request, Response } from 'express';
import QueryString from 'qs';
import { constants } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';


export default class Routes extends Base {
  private kucoin = new Kucoin();
  private indicators = new Indicators();
  private backtest = new Backtester();
  private cmc = new Coinmarketcap();
  private backtests: Record<string, any> = {};

  constructor() {
    super();
    this.loadBacktests();
  }

  private loadBacktests(): void {
    const backtestsDir = path.join(__dirname, 'algorithms/backtesting/backtests');
    this.scanDir(backtestsDir);
  }

  private scanDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.scanDir(fullPath);
      } else if (entry.name.endsWith('.js')) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require(fullPath);
          const ExportedClass = mod.default;
          if (typeof ExportedClass === 'function' && ExportedClass.name) {
            const key = ExportedClass.name.charAt(0).toLowerCase() + ExportedClass.name.slice(1);
            this.backtests[key] = new ExportedClass();
          }
        } catch (err: any) {
          console.warn(`Failed to load backtest from ${fullPath}:`, err);
        }
      }
    }
  }

  /**
   * get list of klines / candlesticks and add buy and sell signals
   * 
   * algorithm is passed through body parameter 'algorithm'
   * depending on algorithm, additional query params may be necessary
   */
  public async getKlinesWithAlgorithm(req: Request, res: Response): Promise<void> {
    const body = req.body;
    const { timeframe, times, exchange, symbol, algorithms } = body;

    try {
      const allKlines: Kline[] = await this.initKlines(exchange, symbol, timeframe);
      let klinesInRange: Kline[] = allKlines.slice(-1000 * Number(times));    // get last times * 1000 timeframes

      for (const algorithm of algorithms) {
        klinesInRange = await this.handleAlgo(klinesInRange, algorithm);
      }

      res.send(klinesInRange);
    } catch (err: any) {
      this.handleError(err);
      res.status(500).json({ error: err.message || err });
    }
  }

  public async runMultiTicker(req: Request, res: Response): Promise<void> {
    const body = req.body;
    const { timeframe, times, commission, rank, autoParams, algorithms } = body;
    const indexSymbols = ['SPY', 'QQQ', 'IWM', 'DAX'].slice(0, rank);

    const [stocks, indexes, cryptos] = await Promise.all([
      this.getMultiStocks(Number(rank)).then((stocksSymbols: string[]) =>
        this.initKlinesMulti(Exchange.Alpaca, stocksSymbols, timeframe, times)
      ),
      this.initKlinesMulti(Exchange.Alpaca, indexSymbols, timeframe, times),
      this.getMultiCryptos(Number(rank)).then((cryptosSymbols: string[]) =>
        this.initKlinesMulti(Exchange.Binance, cryptosSymbols, timeframe, times)
      )
    ]);

    const allTickers: Kline[][] = [...stocks, ...indexes, ...cryptos];
    let tickersWithSignals: Kline[][] = allTickers;

    for (let i = 0; i < algorithms.length; i++) {
      if (autoParams[i]) {
        tickersWithSignals = this.backtests.multiTicker.handleAlgo(tickersWithSignals, algorithms[i].algorithm);
      } else {
        tickersWithSignals = await Promise.all(tickersWithSignals.map(async (klines: Kline[]) => {
          const klinesWithSignals: Kline[] = await this.handleAlgo(klines, algorithms[i]);
          return this.backtest.calcBacktestPerformance(klinesWithSignals, algorithms[i].algorithm, Number(commission));
        }));
      }
    }

    this.reduceTickersToLimit(tickersWithSignals);
    this.log('Multi finished');
    res.send(tickersWithSignals);
  }

  public postBacktestData(req: Request, res: Response): void {
    const query: QueryString.ParsedQs = req.query;
    let klines: Kline[] = req.body;

    for (const algorithm in (req.body as Kline[])[0].algorithms) {
      klines = this.backtest.calcBacktestPerformance(klines, algorithm as Algorithm, Number(query.commission));
    }

    res.send(klines);
  }

  public tradeStrategy(req: Request, res: Response): void {
    switch (req.query.strategy) {
      case Algorithm.Ema: this.backtests.ema.trade(req.query.symbol as string, req.query.open ? true : false);
    }

    res.send('Running');
  }

  public postTechnicalIndicator(req: Request, res: Response): void {
    const query: QueryString.ParsedQs = req.query;
    const { indicator, length, fast, slow, signal, period } = query;
    let indicatorChart: any[];

    switch (indicator) {
      case Algorithm.Rsi: indicatorChart = this.indicators.rsi(req.body, Number(length)); break;
      case Algorithm.Macd: indicatorChart = this.indicators.macd(req.body, Number(fast), Number(slow), Number(signal)); break;
      case Algorithm.Ema: indicatorChart = this.indicators.ema(req.body, Number(period)); break;
      case Algorithm.Bb: indicatorChart = this.indicators.bb(req.body, Number(period)); break;
      default: res.send(`Indicator "${indicator}" does not exist`); return;
    }

    res.send(indicatorChart);
  }

  private async handleAlgo(klines: Kline[], params): Promise<Kline[]> {
    const algorithm: Algorithm = params.algorithm;

    klines.forEach((kline: Kline) => {
      kline.algorithms[algorithm] = {
        signals: []
      };
    });

    const algo = this.backtests[algorithm];
    if (!algo?.setSignals) throw `invalid algorithm ${algorithm}`;
    return algo.setSignals(klines, algorithm, params);
  }

  private async initKlines(exchange: string, symbol: string, timeframe: Timeframe): Promise<Kline[]> {
    switch (exchange) {
      case Exchange.Binance: return binance.initKlinesDatabase(symbol, timeframe);
      case Exchange.Kucoin: return this.kucoin.initKlinesDatabase(symbol, timeframe);
      case Exchange.Alpaca: return alpaca.initKlinesDatabase(symbol, timeframe);
      default: throw new Error(`Invalid exchange ${exchange}`);
    }
  }

  private async initKlinesMulti(exchange: string, symbols: string[], timeframe: Timeframe, times: number): Promise<Kline[][]> {
    const klines: Kline[][] = await Promise.all(symbols.map(symbol => this.initKlines(exchange, symbol, timeframe)));

    const klinesInRange: Kline[][] = klines.map((klines: Kline[]) => {
      return klines.slice(-1000 * Number(times)); // get last times * 1000 timeframes
    });

    return klinesInRange.filter(k => k.length);  // filter out not found symbols
  }

  private async getMultiStocks(rank: number): Promise<string[]> {
    const mostActiveStocks: string[] = await alpaca.getMostActiveStocks(rank);
    return mostActiveStocks;
  }

  private async getMultiCryptos(rank: number): Promise<string[]> {
    const cmcTickers: string[] = await this.cmc.getCryptosByMarketCap(rank);
    const binanceAllPairs: string[] = await binance.getPairs();
    const binancePairs: Array<string | undefined> = binance.symbolsToPairs(cmcTickers, binanceAllPairs);
    const pairsFiltered: string[] = binancePairs.filter((c: string | undefined) => c) as string[];
    const rankPairs: string[] = pairsFiltered.slice(0, rank);
    return rankPairs;
  }

  /**
   * both node and angular have a limit for max response length
   */
  private reduceTickersToLimit(tickers: Kline[][]) {
    const totalKlines: number = tickers.reduce((sum, t) => sum + t.length, 0);
    const totalChars: number = tickers.reduce((sum, t) => sum + JSON.stringify(t).length, 0);
    const avgKlineSizeChars: number = totalChars / totalKlines;
    const klineLimit: number = Math.floor(constants.MAX_STRING_LENGTH * 0.9 / avgKlineSizeChars);

    if (totalKlines <= klineLimit) return;

    const sorted = tickers.map((t, i) => ({ i, len: t.length })).sort((a, b) => a.len - b.len);
    let budget: number = klineLimit;

    sorted.forEach(({ i, len }, j) => {
      const cap: number = Math.floor(budget / (sorted.length - j));
      const keep: number = Math.min(len, cap);
      tickers[i] = tickers[i].slice(-keep);
      budget -= keep;
    });
  }
}