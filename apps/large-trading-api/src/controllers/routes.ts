import Base from '../base';
import { formatDuration } from '../utils';
import { Algorithm, Exchange, Kline, Timeframe } from '@shared';
import alpaca from './exchanges/alpaca';
import binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Backtester from './algorithms/backtesting/backtester/backtester';
import Coinmarketcap from './other-apis/coinmarketcap';
import { Request, Response } from 'express';
import QueryString from 'qs';
import * as fs from 'fs';
import * as path from 'path';


export default class Routes extends Base {
  private kucoin = new Kucoin();
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
      const klinesInRange: Kline[] = allKlines.slice(-1000 * Number(times));    // get last times * 1000 timeframes

      for (const algorithm of algorithms) {
        await this.handleAlgo(klinesInRange, algorithm);
      }

      res.send(klinesInRange);
    } catch (err: any) {
      this.handleError(err);
      res.status(500).json({ error: err.message || err });
    }
  }

  public async runMultiTicker(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const body = req.body;
    const { timeframe, times, commission, rank, autoParams, algorithms } = body;
    const indexSymbols = ['SPY', 'QQQ', 'IWM', 'DAX'].slice(0, rank);

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    req.headers['accept-encoding'] = 'identity'; // disable gzip for this streaming response

    // Keep the connection alive during long processing to prevent idle timeouts (~60s in Chrome/OS)
    const heartbeat = setInterval(() => res.write('\n'), 20_000);

    try {
      const [stocks, indexes, cryptos] = await Promise.all([
        this.getMultiStocks(Number(rank)).then((stocksSymbols: string[]) =>
          this.initKlinesMulti(Exchange.Alpaca, stocksSymbols, timeframe, times)
        ),
        this.initKlinesMulti(Exchange.Alpaca, indexSymbols, timeframe, times),
        this.getMultiCryptos(Number(rank)).then((cryptosSymbols: string[]) =>
          this.initKlinesMulti(Exchange.Binance, cryptosSymbols, timeframe, times)
        )
      ]);

      let tickersWithSignals: Kline[][] = [...stocks, ...indexes, ...cryptos];

      for (let i = 0; i < algorithms.length; i++) {
        if (autoParams[i]) {
          const algoInstance = this.backtests[algorithms[i].algorithm];
          tickersWithSignals = await this.backtests.multiTicker.handleAlgo(tickersWithSignals, algorithms[i], algoInstance);
        } else {
          tickersWithSignals = await Promise.all(tickersWithSignals.map(async (klines: Kline[]) => {
            await this.handleAlgo(klines, algorithms[i]);
            return this.backtest.calcBacktestPerformance(klines, algorithms[i].algorithm, Number(commission));
          }));
        }
      }

      for (let i = 0; i < tickersWithSignals.length; i++) {
        const line = JSON.stringify(tickersWithSignals[i]) + '\n';
        (tickersWithSignals[i] as any) = null; // free memory as we go
        const drained = res.write(line);
        if (!drained) await new Promise<void>((resolve, reject) => {
          const onDrain = () => { res.removeListener('error', onError); resolve(); };
          const onError = (err: Error) => { res.removeListener('drain', onDrain); reject(err); };
          res.once('drain', onDrain);
          res.once('error', onError);
        });
      }

      this.log(`Multi finished in ${formatDuration(Date.now() - startTime)}`);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
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

  private async handleAlgo(klines: Kline[], params): Promise<void> {
    const algorithm: Algorithm = params.algorithm;

    klines.forEach((kline: Kline) => {
      kline.algorithms[algorithm] = {
        signals: []
      };
    });

    const algo = this.backtests[algorithm];
    if (!algo?.setSignals) throw `invalid algorithm ${algorithm}`;
    await algo.setSignals(klines, algorithm, params);
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

}