import { Worker } from 'worker_threads';
import * as path from 'path';
import { AlpacaFeed, Bar, Exchange, StrategyEntry } from '@shared';
import Base from '../../base';
import { Response } from 'express';
import binance from '../../exchanges/binance';
import alpaca from '../../exchanges/alpaca';

interface ExchangeRequest {
  action: 'getLatestPrice' | 'getBarsFromStartUntilNow';
  fromOpenTime?: number;
}

export default class LiveReplay extends Base {
  public async run(
    tickers: Bar[][],
    strategy: StrategyEntry,
    strategyModulePath: string | undefined,
    timeframeMs: number,
    intervalMs: number,
    commission: number,
    onTick: (bar: Bar) => void,
    res: Response
  ): Promise<void> {
    if (!strategyModulePath) throw new Error(`Unable to find strategy module for ${strategy.strategy}`);

    const workers: Worker[] = tickers.map(bars =>
      this.spawnWorker(bars, strategy, strategyModulePath, timeframeMs, intervalMs, commission, onTick)
    );
    const clientDisconnected = new Promise<void>(resolve => res.once('close', resolve));
    const workerFailed = new Promise<void>((resolve, reject) => {
      workers.forEach(worker => worker.once('error', reject));
    });

    try {
      await Promise.race([clientDisconnected, workerFailed]);
    } finally {
      await Promise.all(workers.map(worker => worker.terminate()));
    }
  }

  public resolveStrategyModulePath(strategyInstance: any): string | undefined {
    const ctor = strategyInstance?.constructor;
    if (!ctor) return undefined;
    return Object.keys(require.cache).find(key => require.cache[key]?.exports?.default === ctor);
  }

  private spawnWorker(
    bars: Bar[],
    strategy: StrategyEntry,
    strategyModulePath: string | undefined,
    timeframeMs: number,
    intervalMs: number,
    commission: number,
    onTick: (bar: Bar) => void
  ): Worker {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { bars, strategyConfig: strategy.config, strategyModulePath, timeframeMs, intervalMs, commission }
    });
    worker.on('message', (message: Bar | ExchangeRequest) => {
      if ('action' in message) {
        this.handleExchangeRequest(worker, bars[0], message).catch(err => {
          worker.postMessage({ error: err.message });
        });
      } else {
        onTick(message);
      }
    });
    worker.on('error', err => this.logErr(err));
    return worker;
  }

  private async handleExchangeRequest(worker: Worker, bar: Bar, request: ExchangeRequest): Promise<void> {
    const { exchange, symbol, feed } = bar;
    let result: number | Bar[];

    switch (request.action) {
      case 'getLatestPrice':
        switch (exchange) {
          case Exchange.Binance: result = await binance.getLatestPrice(symbol); break;
          case Exchange.Alpaca: result = await alpaca.getLatestPrice(symbol, feed); break;
          default: throw new Error(`Live prices not supported for ${exchange}`);
        }
        break;
      case 'getBarsFromStartUntilNow':
        if (request.fromOpenTime === undefined) throw new Error('Missing bar fetch start time');
        switch (exchange) {
          case Exchange.Binance: result = await binance.getBarsFromStartUntilNow(symbol, request.fromOpenTime, bar.timeframe); break;
          case Exchange.Alpaca: result = await alpaca.getBarsFromStartUntilNow(symbol, request.fromOpenTime, bar.timeframe, feed as AlpacaFeed); break;
          default: throw new Error(`Bar refresh not supported for ${exchange}`);
        }
        break;
    }

    worker.postMessage({ result });
  }
}
