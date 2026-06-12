import Base from '../base';
import { formatDuration } from '@shared';
import { Algorithm, Exchange, Bar, Timeframe } from '@shared';
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
   * get list of bars / candlesticks and add buy and sell signals
   * 
   * algorithm is passed through body parameter 'algorithm'
   * depending on algorithm, additional query params may be necessary
   */
  public async getBarsWithAlgorithm(req: Request, res: Response): Promise<void> {
    const body = req.body;
    const { timeframe, times, exchange, symbol, algorithms } = body;

    try {
      const allBars: Bar[] = await this.initBars(exchange, symbol, timeframe);
      const barsInRange: Bar[] = allBars.slice(-1000 * Number(times));    // get last times * 1000 timeframes

      for (const algorithm of algorithms) {
        await this.handleAlgo(barsInRange, algorithm);
      }

      res.send(barsInRange);
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
          this.initBarsMulti(Exchange.Alpaca, stocksSymbols, timeframe, times)
        ),
        this.initBarsMulti(Exchange.Alpaca, indexSymbols, timeframe, times),
        this.getMultiCryptos(Number(rank)).then((cryptosSymbols: string[]) =>
          this.initBarsMulti(Exchange.Binance, cryptosSymbols, timeframe, times)
        )
      ]);

      let tickersWithSignals: Bar[][] = [...stocks, ...indexes, ...cryptos];

      for (let i = 0; i < algorithms.length; i++) {
        if (autoParams[i]) {
          const algoInstance = this.backtests[algorithms[i].algorithm];
          tickersWithSignals = await this.backtests.multiTicker.handleAlgo(tickersWithSignals, algorithms[i], algoInstance);
        } else {
          tickersWithSignals = await Promise.all(tickersWithSignals.map(async (bars: Bar[]) => {
            await this.handleAlgo(bars, algorithms[i]);
            return this.backtest.calcBacktestPerformance(bars, algorithms[i].algorithm, Number(commission));
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
    let bars: Bar[] = req.body;

    for (const algorithm in (req.body as Bar[])[0].algorithms) {
      bars = this.backtest.calcBacktestPerformance(bars, algorithm as Algorithm, Number(query.commission));
    }

    res.send(bars);
  }

  public tradeStrategy(req: Request, res: Response): void {
    switch (req.query.strategy) {
      case Algorithm.Ema: this.backtests.ema.trade(req.query.symbol as string, req.query.open ? true : false);
    }

    res.send('Running');
  }

  private async handleAlgo(bars: Bar[], params): Promise<void> {
    const algorithm: Algorithm = params.algorithm;

    bars.forEach((bar: Bar) => {
      bar.algorithms[algorithm] = {
        signals: []
      };
    });

    const algo = this.backtests[algorithm];
    if (!algo?.setSignals) throw `invalid algorithm ${algorithm}`;
    await algo.setSignals(bars, algorithm, params);
  }

  private async initBars(exchange: string, symbol: string, timeframe: Timeframe): Promise<Bar[]> {
    switch (exchange) {
      case Exchange.Binance: return binance.initBarsDatabase(symbol, timeframe);
      case Exchange.Kucoin: return this.kucoin.initBarsDatabase(symbol, timeframe);
      case Exchange.Alpaca: return alpaca.initBarsDatabase(symbol, timeframe);
      default: throw new Error(`Invalid exchange ${exchange}`);
    }
  }

  private async initBarsMulti(exchange: string, symbols: string[], timeframe: Timeframe, times: number): Promise<Bar[][]> {
    const bars: Bar[][] = await Promise.all(symbols.map(symbol => this.initBars(exchange, symbol, timeframe)));

    const barsInRange: Bar[][] = bars.map((bars: Bar[]) => {
      return bars.slice(-1000 * Number(times)); // get last times * 1000 timeframes
    });

    return barsInRange.filter(k => k.length);  // filter out not found symbols
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