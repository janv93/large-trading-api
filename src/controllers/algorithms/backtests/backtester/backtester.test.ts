import { describe, expect, it, beforeEach } from '@jest/globals';
import Backtester from './backtester';
import { Kline, Algorithm, Signal, Timeframe, BacktestData } from '../../../../interfaces';


describe('Backtester', () => {
  let backtester: Backtester;
  const algorithm = Algorithm.Dca;

  beforeEach(() => {
    backtester = new Backtester();
  });

  it('should calculate percentProfit correctly', () => {
    const base = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };

    const klines: Kline[] = [
      {
        ...base,
        prices: { open: 100, close: 100, high: 100, low: 100 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy } }
      },
      {
        ...base,
        prices: { open: 200, close: 200, high: 200, low: 200 },
        algorithms: { [Algorithm.Dca]: {} }
      },
      {
        ...base,
        prices: { open: 200, close: 200, high: 200, low: 200 },
        algorithms: { [Algorithm.Dca]: {} }
      },
      {
        ...base,
        prices: { open: 200, close: 200, high: 200, low: 200 },
        algorithms: { [Algorithm.Dca]: {} }
      }
    ];

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0, true);
    const backtests: BacktestData[] = klinesWithProfit.map(k => k.algorithms[algorithm]!);
    expect(backtests[0].percentProfit).toBe(0);
    expect(backtests[1].percentProfit).toBe(100);
  });
});
