import { workerData, parentPort } from 'worker_threads';
import { Bar, ExchangeRequest, ExchangeResponse, sleep } from '@shared';
import Backtester from '../backtester/backtester';
import LiveWorkerLifecycle from './worker-lifecycle';

const { bars, strategyConfig, strategyModulePath, timeframeMs, intervalMs, commission } = workerData;

const strategyInstance = new (require(strategyModulePath).default)();
strategyInstance.silent = true;
const backtester = new Backtester();
const lifecycle = new LiveWorkerLifecycle({ strategyInstance, backtester, strategyConfig, timeframeMs, commission });

function requestExchange<T>(request: ExchangeRequest): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    parentPort!.once('message', (message: ExchangeResponse) => {
      if (message.error) reject(new Error(message.error));
      else resolve(message.result as T);
    });

    parentPort!.postMessage(request);
  });
}

async function refreshWindow(): Promise<void> {
  if (!lifecycle.shouldRefresh()) return;
  const lastCommittedBar: Bar = lifecycle.getLastCommittedBar();

  const fetchedBars: Bar[] = await requestExchange<Bar[]>({
    action: 'getBarsFromStartUntilNow',
    fromOpenTime: lastCommittedBar.times.open,
  });

  const refreshedBars: Bar[] = await lifecycle.refreshWindow(fetchedBars);
  refreshedBars.forEach((bar) => parentPort!.postMessage(bar));
}

async function tick(): Promise<void> {
  if (lifecycle.shouldRefresh()) return;
  const price: number = await requestExchange<number>({ action: 'getLatestPrice' });
  // Ignore a price fetched after its bar closed.
  if (lifecycle.shouldRefresh()) return;
  parentPort!.postMessage(await lifecycle.processTick(price));
}

async function run(): Promise<void> {
  await lifecycle.initialize(bars);

  while (true) {
    await refreshWindow();
    await tick();
    await sleep(intervalMs);
  }
}

run();
