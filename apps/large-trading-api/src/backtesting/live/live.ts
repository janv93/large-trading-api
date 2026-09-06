import { Worker } from 'worker_threads';
import * as path from 'path';
import { Bar, Exchange, LiveStrategyEntry } from '@shared';
import { Response } from 'express';
import binance from '../../exchanges/binance';
import alpaca from '../../exchanges/alpaca';

export default class Live {
  public async run(
    tickers: Bar[][],
    strategyEntry: LiveStrategyEntry,
    strategyInstance: any,
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
        workers.push(this.spawnWorker(bars, strategyEntry, strategyModulePath, timeframeMs, intervalMs, commission, onBar));
      }
      const workerFailed = new Promise<never>((_, reject) => {
        workers.forEach((worker) => worker.once('error', reject));
      });

      await Promise.race([clientDisconnected, workerFailed]); // Stop on disconnect or worker failure.
    } finally {
      await Promise.all(workers.map((worker) => worker.terminate())); // Always terminate every worker.
    }
  }

  private resolveStrategyModulePath(strategyInstance: any): string {
    const constructor = strategyInstance.constructor;
    return Object.keys(require.cache).find((key) => require.cache[key]?.exports?.default === constructor)!;
  }

  private spawnWorker(
    bars: Bar[],
    strategyEntry: LiveStrategyEntry,
    strategyModulePath: string,
    timeframeMs: number,
    intervalMs: number,
    commission: number,
    onBar: (bar: Bar) => void,
  ): Worker {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { bars, strategyConfig: strategyEntry.config, strategyModulePath, timeframeMs, intervalMs, commission },
    });

    worker.on('message', (message: Bar | string) => {
      if (message === 'getLatestPrice') {
        this.handleLatestPriceRequest(worker, bars[0]).catch((err) => {
          worker.postMessage({ error: err.message });
        });
      } else if (typeof message !== 'string') {
        onBar(message);
      }
    });

    return worker;
  }

  private async handleLatestPriceRequest(worker: Worker, bar: Bar): Promise<void> {
    const price: number = await this.getLatestPrice(bar);
    worker.postMessage({ price });
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
}
