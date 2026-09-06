import { Worker } from 'worker_threads';
import * as path from 'path';
import { AlpacaFeed, Bar, Exchange, ExchangeRequest, LiveStrategyInstance, StrategyEntry } from '@shared';
import { Response } from 'express';
import binance from '../../exchanges/binance';
import alpaca from '../../exchanges/alpaca';

export default class Live {
  public async run(
    tickers: Bar[][],
    strategy: StrategyEntry,
    strategyInstance: LiveStrategyInstance,
    timeframeMs: number,
    intervalMs: number,
    commission: number,
    onBar: (bar: Bar) => void,
    res: Response,
  ): Promise<void> {
    if (tickers.length === 0 || res.destroyed || res.writableEnded) return;
    const strategyModulePath: string = this.resolveStrategyModulePath(strategyInstance);
    const clientDisconnected = new Promise<void>((resolve) => res.once('close', resolve));
    const workers: Worker[] = [];

    try {
      for (const bars of tickers) {
        workers.push(this.spawnWorker(bars, strategy, strategyModulePath, timeframeMs, intervalMs, commission, onBar));
      }
      const workerFailed = new Promise<never>((_, reject) => {
        workers.forEach((worker) => worker.once('error', reject));
      });

      await Promise.race([clientDisconnected, workerFailed]); // Stop on disconnect or worker failure.
    } finally {
      await Promise.all(workers.map((worker) => worker.terminate())); // Always terminate every worker.
    }
  }

  private resolveStrategyModulePath(strategyInstance: LiveStrategyInstance): string {
    const constructor = strategyInstance.constructor;
    return Object.keys(require.cache).find((key) => require.cache[key]?.exports?.default === constructor)!;
  }

  private spawnWorker(
    bars: Bar[],
    strategy: StrategyEntry,
    strategyModulePath: string,
    timeframeMs: number,
    intervalMs: number,
    commission: number,
    onBar: (bar: Bar) => void,
  ): Worker {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { bars, strategyConfig: strategy.config, strategyModulePath, timeframeMs, intervalMs, commission },
    });

    worker.on('message', (message: Bar | ExchangeRequest) => {
      if ('action' in message) {
        this.handleExchangeRequest(worker, bars[0], message).catch((err) => {
          worker.postMessage({ error: err.message });
        });
      } else {
        onBar(message);
      }
    });

    return worker;
  }

  private async handleExchangeRequest(worker: Worker, bar: Bar, request: ExchangeRequest): Promise<void> {
    const result: number | Bar[] =
      request.action === 'getLatestPrice' ? await this.getLatestPrice(bar) : await this.getBarsFromStartUntilNow(bar, request.fromOpenTime);
    worker.postMessage({ result });
  }

  private getLatestPrice(bar: Bar): Promise<number> {
    switch (bar.exchange) {
      case Exchange.Binance:
        return binance.getLatestPrice(bar.symbol);
      case Exchange.Alpaca:
        return alpaca.getLatestPrice(bar.symbol, bar.feed);
      default:
        throw new Error(`Live prices not supported for ${bar.exchange}`);
    }
  }

  private getBarsFromStartUntilNow(bar: Bar, fromOpenTime: number): Promise<Bar[]> {
    switch (bar.exchange) {
      case Exchange.Binance:
        return binance.getBarsFromStartUntilNow(bar.symbol, fromOpenTime, bar.timeframe);
      case Exchange.Alpaca:
        return alpaca.getBarsFromStartUntilNow(bar.symbol, fromOpenTime, bar.timeframe, bar.feed as AlpacaFeed);
      default:
        throw new Error(`Bar refresh not supported for ${bar.exchange}`);
    }
  }
}
