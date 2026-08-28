import { workerData, parentPort } from 'worker_threads';
import { BacktesterState, Bar, sleep, clone } from '@shared';
import Backtester from '../backtester/backtester';

interface ExchangeResponse {
  result?: any;
  error?: string;
}

const { bars, strategyConfig, strategyModulePath, timeframeMs, intervalMs, commission } = workerData;

const strategyInstance = new (require(strategyModulePath).default)();
strategyInstance.silent = true;
const backtester = new Backtester();

const state = {};
const backtesterState: BacktesterState = {};
const window: Bar[] = [];
let pendingRequest;

parentPort!.on('message', (message: ExchangeResponse) => {
  if (message.error) pendingRequest.reject(new Error(message.error));
  else pendingRequest.resolve(message.result);
  pendingRequest = undefined;
});

function getLatestPrice(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    pendingRequest = { resolve, reject };
    parentPort!.postMessage({ action: 'getLatestPrice' });
  });
}

function getBarsFromStartUntilNow(fromOpenTime: number): Promise<Bar[]> {
  return new Promise<Bar[]>((resolve, reject) => {
    pendingRequest = { resolve, reject };
    parentPort!.postMessage({ action: 'getBarsFromStartUntilNow', fromOpenTime });
  });
}

async function stepBar(bar: Bar): Promise<void> {
  window.push(bar);
  await strategyInstance.stepSetSignals(window, state, strategyConfig);
  backtester.stepCalcBacktestPerformance(window, backtesterState, commission);
}

async function refreshWindow(): Promise<void> {
  const lastProcessedBar: Bar = window[window.length - 1];
  const nextBarCloseTime: number = lastProcessedBar.times.open + timeframeMs * 2;
  if (Date.now() < nextBarCloseTime) return;

  const fetchedBars: Bar[] = await getBarsFromStartUntilNow(lastProcessedBar.times.open);
  const newBars: Bar[] = fetchedBars.filter(bar => bar.times.open > lastProcessedBar.times.open);
  if (newBars.length === 0) return;

  for (const bar of newBars) await stepBar(bar);
}

async function tick(): Promise<void> {
  const price: number = await getLatestPrice();
  const committed: Bar = window[window.length - 1];

  const tempBar: Bar = {
    symbol: committed.symbol,
    exchange: committed.exchange,
    ...(committed.feed ? { feed: committed.feed } : {}),
    timeframe: committed.timeframe,
    times: { open: committed.times.open + timeframeMs },
    prices: { open: price, high: price, low: price, close: price },
    volume: 0,
    backtest: { signals: [] }
  };

  const tempState = clone(state);
  await strategyInstance.stepSetSignals([...window, tempBar], tempState, strategyConfig);
  const tempWindow: Bar[] = [...window, tempBar];
  backtester.stepCalcBacktestPerformance(tempWindow, clone(backtesterState), commission);

  parentPort!.postMessage(tempBar);
}

async function run(): Promise<void> {
  for (const bar of bars) await stepBar(bar);

  while (true) {
    await refreshWindow();
    await tick();
    await sleep(intervalMs);
  }
}

run();
