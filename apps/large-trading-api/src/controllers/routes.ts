import Base from '../base';
import { formatDuration } from '@shared';
import { Algorithm, Exchange, Bar, Run, Timeframe } from '@shared';
import alpaca from './exchanges/alpaca';
import binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Backtester from './algorithms/backtesting/backtester/backtester';
import Coinmarketcap from './other-apis/coinmarketcap';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';


export default class Routes extends Base {
  private kucoin = new Kucoin();
  private backtester = new Backtester();
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

  public async backtest(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const body = req.body;
    const { timeframe, times, commission = 0, rank, autoParams, algorithms, symbols } = body;
    // symbols: optional [{exchange: string, symbol: string}] — when provided, use these instead of rank-based list

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    req.headers['accept-encoding'] = 'identity'; // disable gzip for this streaming response

    // Keep the connection alive during long processing to prevent idle timeouts (~60s in Chrome/OS)
    const heartbeat = setInterval(() => res.write('\n'), 20_000);

    try {
      const symbolGroups = await this.getSymbolGroups(symbols, rank);

      let tickerBars: Bar[][] = (await Promise.all(
        symbolGroups.map(([exchange, syms]) => this.initBarsMulti(exchange, syms, timeframe, times))
      )).flat();

      // Apply signals — autoParams is supported in both modes
      for (let i = 0; i < algorithms.length; i++) {
        if (autoParams?.[i]) {
          const algoInstance = this.backtests[algorithms[i].algorithm];
          tickerBars = await this.backtests.multiTicker.handleAlgo(tickerBars, algorithms[i], algoInstance);
        } else {
          await Promise.all(tickerBars.map((bars: Bar[]) => this.handleAlgo(bars, algorithms[i])));
        }
      }

      // Stream: always 2 runs — commission=0 and actual commission
      for (let i = 0; i < tickerBars.length; i++) {
        const bars = tickerBars[i];

        const barsZeroCommission: Bar[] = JSON.parse(JSON.stringify(bars));
        for (const algorithm of algorithms) {
          this.backtester.calcBacktestPerformance(barsZeroCommission, algorithm.algorithm, 0);
        }

        for (const algorithm of algorithms) {
          this.backtester.calcBacktestPerformance(bars, algorithm.algorithm, Number(commission));
        }

        const runs: Run[] = [
          { bars: barsZeroCommission, commission: 0 },
          { bars, commission: Number(commission) }
        ];

        (tickerBars[i] as any) = null; // free memory as we go
        const line = JSON.stringify(runs) + '\n';
        const drained = res.write(line);
        if (!drained) await new Promise<void>((resolve, reject) => {
          const onDrain = () => { res.removeListener('error', onError); resolve(); };
          const onError = (err: Error) => { res.removeListener('drain', onDrain); reject(err); };
          res.once('drain', onDrain);
          res.once('error', onError);
        });
      }

      this.log(`Run finished in ${formatDuration(Date.now() - startTime)}`);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
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

  private async getSymbolGroups(symbols: { exchange: string; symbol: string }[] | undefined, rank: number): Promise<[string, string[]][]> {
    if (symbols?.length) {
      const byExchange = new Map<string, string[]>();
      for (const { exchange, symbol } of symbols) {
        if (!byExchange.has(exchange)) byExchange.set(exchange, []);
        byExchange.get(exchange)!.push(symbol);
      }
      return [...byExchange.entries()];
    }

    const [stockSymbols, cryptoSymbols] = await Promise.all([
      this.getMultiStocks(rank),
      this.getMultiCryptos(rank)
    ]);
    return [
      [Exchange.Alpaca, stockSymbols],
      [Exchange.Alpaca, ['SPY', 'QQQ', 'IWM', 'DAX'].slice(0, rank)],
      [Exchange.Binance, cryptoSymbols]
    ];
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