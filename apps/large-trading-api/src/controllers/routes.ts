import Base from '../base';
import { Algorithm, BacktesterState, Exchange, ExchangeSymbol, Bar, Run, Timeframe, countBars, formatDuration } from '@shared';
import alpaca from './exchanges/alpaca';
import binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Backtester from './algorithms/backtesting/backtester/backtester';
import AutoParams from './algorithms/backtesting/auto-params';
import Coinmarketcap from './other-apis/coinmarketcap';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';


export default class Routes extends Base {
  private kucoin = new Kucoin();
  private backtester = new Backtester();
  private autoParams = new AutoParams();
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
    const { timeframe, times, commission, rank, algorithms, symbols, autoSymbols } = req.body;

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    req.headers['accept-encoding'] = 'identity'; // disable gzip for this streaming response
    const heartbeat = setInterval(() => res.write('\n'), 20_000); // Keep the connection alive during long processing to prevent idle timeouts (~60s in Chrome/OS)

    try {
      const exchangeSymbolsGroups: Map<Exchange, string[]> = await this.getExchangeSymbolsGroups(autoSymbols, symbols, rank);

      let tickers: Bar[][] = (await Promise.all(
        [...exchangeSymbolsGroups].map(([exchange, syms]) => this.initBarsMulti(exchange, syms, timeframe, times))
      )).flat();

      this.startProgress(this.countSteps(tickers, algorithms));
      tickers = await this.handleAlgos(tickers, algorithms);

      for (let i = 0; i < tickers.length; i++) {
        const bars: Bar[] = tickers[i];
        (tickers[i] as any) = null; // free memory as frontend allocates it

        const runs: Run[] = this.backtestTicker(bars, algorithms, Number(commission));
        await this.streamRuns(runs, res);
      }

      this.log(`Run finished in ${formatDuration(Date.now() - startTime)}`);
    } finally {
      this.endProgress();
      clearInterval(heartbeat);
      res.end();
    }
  }

  /** every phase counts one step per bar it walks, so their shares of the progress bar fall out of the work they actually do */
  private countSteps(tickers: Bar[][], algorithms: any[]): number {
    const bars: number = countBars(tickers);
    const signalSteps: number = algorithms.reduce((sum: number, algo: any) => sum +
      (algo.autoParams ? this.autoParams.countSteps(tickers, algo.config) : bars), 0);
    return signalSteps + bars;
  }

  private async handleAlgos(tickers: Bar[][], algorithms: any[]): Promise<Bar[][]> {
    for (const algo of algorithms) {
      if (algo.autoParams) {
        const algoInstance = this.backtests[algo.algorithm];
        tickers = await this.autoParams.handleAlgo(tickers, algo.algorithm, algo.config, algoInstance, (steps: number) => this.addProgress(steps));
      } else {
        await Promise.all(tickers.map((bars: Bar[]) => this.handleAlgo(bars, algo.algorithm, algo.config)));
      }
    }

    return tickers;
  }

  private backtestTicker(bars: Bar[], algorithms: any[], commission: number): Run[] {
    const barsZeroCommission: Bar[] = JSON.parse(JSON.stringify(bars));
    const statesZero: BacktesterState[] = algorithms.map(() => ({}));
    const statesActual: BacktesterState[] = algorithms.map(() => ({}));
    const windowZero: Bar[] = []; // grown by push, a slice per bar would copy the whole prefix and make the run quadratic
    const windowActual: Bar[] = [];

    for (let j = 0; j < bars.length; j++) {
      windowZero.push(barsZeroCommission[j]);
      windowActual.push(bars[j]);

      for (let k = 0; k < algorithms.length; k++) {
        this.backtester.stepCalcBacktestPerformance(windowZero, statesZero[k], algorithms[k].algorithm, 0);
        this.backtester.stepCalcBacktestPerformance(windowActual, statesActual[k], algorithms[k].algorithm, commission);
      }

      this.addProgress(1);
    }

    return [
      { bars: barsZeroCommission, commission: 0 },
      { bars, commission }
    ];
  }

  private async streamRuns(runs: Run[], res: Response): Promise<void> {
    const line: string = JSON.stringify(runs) + '\n';
    const drained: boolean = res.write(line);
    if (drained) return;

    await new Promise<void>((resolve, reject) => {
      const onDrain = () => { res.removeListener('error', onError); resolve(); };
      const onError = (err: Error) => { res.removeListener('drain', onDrain); reject(err); };
      res.once('drain', onDrain);
      res.once('error', onError);
    });
  }

  private async handleAlgo(bars: Bar[], algorithm: Algorithm, config: any): Promise<void> {
    bars.forEach((bar: Bar) => {
      bar.algorithms[algorithm] = {
        signals: []
      };
    });

    const algo = this.backtests[algorithm];
    if (!algo?.stepSetSignals) throw `invalid algorithm ${algorithm}`;

    const state: any = {};
    const window: Bar[] = []; // grown by push, a slice per bar would copy the whole prefix and make the run quadratic

    for (let i = 0; i < bars.length; i++) {
      window.push(bars[i]);
      await algo.stepSetSignals(window, state, algorithm, config);
      this.addProgress(1);
    }
  }

  private async initBars(exchange: Exchange, symbol: string, timeframe: Timeframe): Promise<Bar[]> {
    switch (exchange) {
      case Exchange.Binance: return binance.initBarsDatabase(symbol, timeframe);
      case Exchange.Kucoin: return this.kucoin.initBarsDatabase(symbol, timeframe);
      case Exchange.Alpaca: return alpaca.initBarsDatabase(symbol, timeframe);
      default: throw new Error(`Invalid exchange ${exchange}`);
    }
  }

  private async initBarsMulti(exchange: Exchange, symbols: string[], timeframe: Timeframe, times: number): Promise<Bar[][]> {
    const bars: Bar[][] = await Promise.all(symbols.map(symbol => this.initBars(exchange, symbol, timeframe)));

    const barsInRange: Bar[][] = bars.map((bars: Bar[]) => {
      return bars.slice(-1000 * Number(times)); // get last times * 1000 timeframes
    });

    return barsInRange.filter(k => k.length);  // filter out not found symbols
  }

  private async getExchangeSymbolsGroups(autoSymbols: boolean, symbols?: ExchangeSymbol[], rank?: number): Promise<Map<Exchange, string[]>> {
    if (autoSymbols) {
      const indices = ['SPY', 'QQQ', 'IWM', 'DAX'];
      const [stockSymbols, cryptoSymbols] = await Promise.all([
        this.getMultiStocks(rank!),
        this.getMultiCryptos(rank!)
      ]);
      return new Map([
        [Exchange.Alpaca, [...stockSymbols, ...indices.slice(0, rank!)]],
        [Exchange.Binance, cryptoSymbols]
      ]);
    } else {
      const map = new Map<Exchange, string[]>();

      for (const { exchange, symbol } of symbols!) {
        if (!map.has(exchange)) map.set(exchange, []);
        map.get(exchange)!.push(symbol);
      }

      return map;
    }
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