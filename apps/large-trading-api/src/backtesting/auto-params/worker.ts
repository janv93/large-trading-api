import { workerData, parentPort } from 'worker_threads';
import { Bar, MultiBenchmark, calcScore } from '@shared';
import Backtester from '../backtester/backtester';

const { sharedBuffer, bufferLength, combo, strategyModulePath } = workerData;

const bytes = new Uint8Array(sharedBuffer, 0, bufferLength);

const StrategyClass = require(strategyModulePath).default;
const strategyInstance = new StrategyClass();
const backtester = new Backtester();
strategyInstance.silent = true;
backtester.silent = true;

const tickers: Bar[][] = JSON.parse(Buffer.from(bytes).toString('utf-8'));
// Capture RSS here — after deserialization (the dominant allocation) and before
// processing, so GC has not had a chance to deflate the value yet.
const peakRss = process.memoryUsage().rss;

tickers.forEach((currentTicker: Bar[]) => {
  currentTicker.forEach((bar: Bar) => {
    bar.candlestickPatterns = undefined;
    bar.backtest = { signals: [] };
    bar.indicators = undefined;
    bar.chart = undefined;
  });
});

async function run() {
  let steps = 0;

  const reportProgress = () => { // batched so a long run does not flood the main thread
    if (++steps % 1000 === 0) parentPort!.postMessage({ steps: 1000 });
  };

  for (const currentTicker of tickers) {
    const signalState: any = {};
    const signalWindow: Bar[] = []; // grown by push, a slice per bar would copy the whole prefix and make the run quadratic

    for (let i = 0; i < currentTicker.length; i++) {
      signalWindow.push(currentTicker[i]);
      await strategyInstance.stepSetSignals(signalWindow, signalState, combo);
      reportProgress();
    }

    const backtesterState: any = {};
    const backtesterWindow: Bar[] = [];

    for (let i = 0; i < currentTicker.length; i++) {
      backtesterWindow.push(currentTicker[i]);
      backtester.stepCalcBacktestPerformance(backtesterWindow, backtesterState, 0);
      reportProgress();
    }
  }

  const score: number = calcScore(tickers);
  const result: MultiBenchmark = { score, params: combo };

  parentPort!.postMessage({ steps: steps % 1000, result, peakRss });
}

run();
