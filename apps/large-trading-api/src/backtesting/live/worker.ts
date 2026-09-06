import { MessagePort, workerData, parentPort } from 'worker_threads';
import { Bar, LiveLatestPriceResponse, sleep } from '@shared';
import Backtester from '../backtester/backtester';
import LiveWorkerLifecycle from './worker-lifecycle';

if (!parentPort) {
  throw new Error('This file must run as a worker thread.');
}

const port: MessagePort = parentPort;
const { bars, strategyConfig, strategyModulePath, timeframeMs, intervalMs, commission } = workerData;

const strategyInstance = new (require(strategyModulePath).default)();
strategyInstance.silent = true;
const backtesterInstance = new Backtester();
const lifecycle = new LiveWorkerLifecycle({ strategyInstance, backtesterInstance, strategyConfig, timeframeMs, commission });

function getLatestPrice(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    port.once('message', (message: LiveLatestPriceResponse) => {
      if (message.error) reject(new Error(message.error));
      else resolve(message.price!);
    });

    port.postMessage('getLatestPrice');
  });
}

function finalizeBar(): void {
  const finalized: Bar | undefined = lifecycle.finalizeBar();
  if (finalized) port.postMessage(finalized);
}

async function tick(): Promise<void> {
  if (lifecycle.isActiveBarClosed()) return;
  const price: number = await getLatestPrice();
  if (lifecycle.isActiveBarClosed()) return; // Ignore a price fetched after its bar closed
  const tickBar: Bar = await lifecycle.processTick(price);
  port.postMessage(tickBar);
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
