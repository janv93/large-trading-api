import { parentPort } from 'worker_threads';
import MeanReversion from '../investing/mean-reversion';
import Backtest from '../backtest';
import { Kline } from '../../../interfaces';

const meanReversion = new MeanReversion();
const backtest = new Backtest();

parentPort?.on('message', ({ tickers, threshold, profitBasedTrailingStopLoss }: { tickers: Kline[], threshold: number, profitBasedTrailingStopLoss: number }) => {
  const klinesWithSignals = meanReversion.setSignals(tickers, threshold, profitBasedTrailingStopLoss);
  const klinesWithBacktest = backtest.calcBacktestPerformance(klinesWithSignals, 0, true);
  parentPort?.postMessage(klinesWithBacktest);
});
