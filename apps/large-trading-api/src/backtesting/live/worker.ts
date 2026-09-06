import { workerData, parentPort } from 'worker_threads';
import { Bar, LatestPriceRequest, ExchangeResponse, sleep } from '@shared';
import Backtester from '../backtester/backtester';
import LiveWorkerLifecycle from './worker-lifecycle';

const { bars, strategyConfig, strategyModulePath, timeframeMs, intervalMs, commission } = workerData;

const strategyInstance = new (require(strategyModulePath).default)();
strategyInstance.silent = true;
const backtester = new Backtester();
const lifecycle = new LiveWorkerLifecycle({ strategyInstance, backtester, strategyConfig, timeframeMs, commission });

function requestExchange<T>(request: LatestPriceRequest): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    parentPort!.once('message', (message: ExchangeResponse) => {
      if (message.error) reject(new Error(message.error));
      else resolve(message.result as T);
    });

    parentPort!.postMessage(request);
  });
}

function finalizeBar(): void {
  const finalized: Bar | undefined = lifecycle.finalizeBar();
  if (finalized) parentPort!.postMessage(finalized);
}

async function tick(): Promise<void> {
  if (lifecycle.isActiveBarClosed()) return;
  const price: number = await requestExchange<number>({ action: 'getLatestPrice' });
  if (lifecycle.isActiveBarClosed()) return; // Ignore a price fetched after its bar closed
  const tickBar: Bar = await lifecycle.processTick(price);
  parentPort!.postMessage(tickBar);
}

async function run(): Promise<void> {
  await lifecycle.initialize(bars);

  while (true) {
    finalizeBar();
    await tick();
    await sleep(intervalMs);
  }
}

run();
