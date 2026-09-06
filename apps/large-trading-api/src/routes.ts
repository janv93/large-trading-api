import Base from './base';
import {
  Strategy,
  BacktesterState,
  Exchange,
  ExchangeSymbol,
  Bar,
  Run,
  Timeframe,
  countBars,
  formatDuration,
  timeframeToMilliseconds,
} from '@shared';
import alpaca from './exchanges/alpaca';
import binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Backtester from './backtesting/backtester/backtester';
import AutoParams from './backtesting/auto-params/auto-params';
import Live from './backtesting/live/live';
import Coinmarketcap from './other-apis/coinmarketcap';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export default class Routes extends Base {
  private kucoin = new Kucoin();
  private backtester = new Backtester();
  private autoParams = new AutoParams();
  private live = new Live();
  private cmc = new Coinmarketcap();
  private backtests: Record<string, any> = {};

  constructor() {
    super();
    this.loadBacktests();
  }

  private loadBacktests(): void {
    const backtestsDir = path.join(__dirname, 'strategies');
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
    const { timeframe, times, commission, rank, strategy, symbols, autoSymbols } = req.body;

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    req.headers['accept-encoding'] = 'identity'; // disable gzip for this streaming response
    const heartbeat = setInterval(() => res.write('\n'), 20_000); // Keep the connection alive during long processing to prevent idle timeouts (~60s in Chrome/OS)

    try {
      const exchangeSymbols: ExchangeSymbol[] = await this.getExchangeSymbols(autoSymbols, symbols, rank);
      let tickers: Bar[][] = await this.initBarsMulti(exchangeSymbols, timeframe, times);

      this.startProgress(this.countSteps(tickers, strategy));
      tickers = await this.handleStrategies(tickers, strategy);

      for (let i = 0; i < tickers.length; i++) {
        const bars: Bar[] = tickers[i];
        (tickers[i] as any) = null; // free memory as frontend allocates it

        const runs: Run[] = this.backtestTicker(bars, Number(commission));
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
  private countSteps(tickers: Bar[][], strategy: any): number {
    const bars: number = countBars(tickers);
    const signalSteps: number = strategy.autoParams ? this.autoParams.countSteps(tickers, strategy.config) : bars;
    return signalSteps + bars;
  }

  private async handleStrategies(tickers: Bar[][], strategy: any): Promise<Bar[][]> {
    if (strategy.autoParams) {
      const strategyInstance = this.backtests[strategy.strategy];
      tickers = await this.autoParams.handleStrategy(tickers, strategy.config, strategyInstance, (steps: number) =>
        this.addProgress(steps),
      );
    } else {
      await Promise.all(tickers.map((bars: Bar[]) => this.handleStrategy(bars, strategy.strategy, strategy.config)));
    }

    return tickers;
  }

  private backtestTicker(bars: Bar[], commission: number): Run[] {
    const barsZeroCommission: Bar[] = JSON.parse(JSON.stringify(bars));
    const stateZero: BacktesterState = {};
    const stateActual: BacktesterState = {};
    const windowZero: Bar[] = []; // grown by push, a slice per bar would copy the whole prefix and make the run quadratic
    const windowActual: Bar[] = [];

    for (let j = 0; j < bars.length; j++) {
      windowZero.push(barsZeroCommission[j]);
      windowActual.push(bars[j]);
      this.backtester.stepCalcBacktestPerformance(windowZero, stateZero, 0);
      this.backtester.stepCalcBacktestPerformance(windowActual, stateActual, commission);
      this.addProgress(1);
    }

    return [
      { bars: barsZeroCommission, commission: 0 },
      { bars, commission },
    ];
  }

  private async streamRuns(runs: Run[], res: Response): Promise<void> {
    const line: string = JSON.stringify(runs) + '\n';
    const drained: boolean = res.write(line);
    if (drained) return;

    await new Promise<void>((resolve, reject) => {
      const onDrain = () => {
        res.removeListener('error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        res.removeListener('drain', onDrain);
        reject(err);
      };

      res.once('drain', onDrain);
      res.once('error', onError);
    });
  }

  private async handleStrategy(bars: Bar[], strategy: Strategy, config: any): Promise<any> {
    bars.forEach((bar: Bar) => {
      bar.backtest = { signals: [] };
    });

    const strategyInstance = this.backtests[strategy];
    if (!strategyInstance?.stepSetSignals) throw `invalid strategy ${strategy}`;

    const state: any = {};
    const window: Bar[] = []; // grown by push, a slice per bar would copy the whole prefix and make the run quadratic

    for (let i = 0; i < bars.length; i++) {
      window.push(bars[i]);
      await strategyInstance.stepSetSignals(window, state, config);
      this.addProgress(1);
    }

    return state;
  }

  private async initBars(exchangeSymbol: ExchangeSymbol, timeframe: Timeframe, fetchLatest?: boolean): Promise<Bar[]> {
    const { exchange, symbol, feed } = exchangeSymbol;

    switch (exchange) {
      case Exchange.Binance:
        return binance.initBarsDatabase(symbol, timeframe, fetchLatest);
      case Exchange.Kucoin:
        return this.kucoin.initBarsDatabase(symbol, timeframe);
      case Exchange.Alpaca:
        return alpaca.initBarsDatabase(symbol, timeframe, feed, fetchLatest);
      default:
        throw new Error(`Invalid exchange ${exchange}`);
    }
  }

  private async initBarsMulti(
    exchangeSymbols: ExchangeSymbol[],
    timeframe: Timeframe,
    times: number,
    fetchLatest?: boolean,
  ): Promise<Bar[][]> {
    const bars: Bar[][] = await Promise.all(exchangeSymbols.map((exchangeSymbol) => this.initBars(exchangeSymbol, timeframe, fetchLatest)));

    const barsInRange: Bar[][] = bars.map((bars: Bar[]) => {
      return bars.slice(-1000 * Number(times)); // get last times * 1000 timeframes
    });

    return barsInRange.filter((k) => k.length); // filter out not found symbols
  }

  private async getExchangeSymbols(autoSymbols: boolean, symbols?: ExchangeSymbol[], rank?: number): Promise<ExchangeSymbol[]> {
    if (autoSymbols) {
      const indices = ['SPY', 'QQQ', 'IWM', 'DAX'];
      const [stockSymbols, cryptoSymbols] = await Promise.all([this.getMultiStocks(rank!), this.getMultiCryptos(rank!)]);
      return [
        ...stockSymbols.map((symbol) => ({ exchange: Exchange.Alpaca, symbol })),
        ...indices.slice(0, rank!).map((symbol) => ({ exchange: Exchange.Alpaca, symbol })),
        ...cryptoSymbols.map((symbol) => ({ exchange: Exchange.Binance, symbol })),
      ];
    }

    return symbols!;
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

  public async handleLive(req: Request, res: Response): Promise<void> {
    const { timeframe, times, commission = 0, strategy, symbols, autoSymbols, rank, intervalMs = 5000 } = req.body;

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    req.headers['accept-encoding'] = 'identity';
    const heartbeat: NodeJS.Timeout = setInterval(() => res.write('\n'), 20_000);

    try {
      const exchangeSymbols: ExchangeSymbol[] = await this.getExchangeSymbols(autoSymbols, symbols, rank);
      const tickers: Bar[][] = await this.initBarsMulti(exchangeSymbols, timeframe, times, true);
      const timeframeMs: number = timeframeToMilliseconds(timeframe);

      const onBar = (bar: Bar) => {
        if (!res.writableEnded) res.write(JSON.stringify(bar) + '\n');
      };

      await this.live.run(tickers, strategy, this.backtests[strategy.strategy], timeframeMs, intervalMs, Number(commission), onBar, res);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }
}
