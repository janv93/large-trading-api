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
    const basePrices = { open: 0, high: 0, low: 0 };

    const klines: Kline[] = [
      {
        ...base,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Close } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Sell } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 300 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.CloseBuy } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 450 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.CloseSell } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 0 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Close } }
      }
    ];

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0, true);
    const backtests: BacktestData[] = klinesWithProfit.map(k => k.algorithms[algorithm]!);

    expect(backtests[0].percentProfit).toBe(0);
    expect(backtests[1].percentProfit).toBe(100);
    expect(backtests[2].percentProfit).toBe(100);
    expect(backtests[3].percentProfit).toBe(50);
    expect(backtests[4].percentProfit).toBe(100);
    expect(backtests[5].percentProfit).toBe(200);
  });
});
