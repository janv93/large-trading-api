import { describe, expect, it, fit, beforeEach } from '@jest/globals';
import Base from './base';
import { Algorithm, BacktestData, Kline, Signal, Timeframe } from '../interfaces';


describe('Backtester', () => {
  let base: Base;
  const algorithm = Algorithm.Dca;

  beforeEach(() => {
    base = new Base();
  });

  it('should set correct default tp/sl signals on klines', () => {
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, volume: 0 };
    const basePrices = { open: 0, close: 0 };

    const klines: Kline[] = [
      {
        ...baseKline,
        times: { open: 1, close: 0 },
        prices: { ...basePrices, high: 120, low: 80 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy, signalPrice: 100, amount: 2 } }
      },
      {
        ...baseKline,
        times: { open: 2, close: 0 },
        prices: { ...basePrices, high: 120, low: 95 },
        algorithms: { [Algorithm.Dca]: {} }
      },
      {
        ...baseKline,
        times: { open: 3, close: 0 },
        prices: { ...basePrices, high: 120, low: 90 },
        algorithms: { [Algorithm.Dca]: {} }
      }
    ];

    (base as any).addTpSlSignals(klines, Algorithm.Dca, 0.1, 0.5);
    const backtests: BacktestData[] = klines.map(k => k.algorithms[algorithm]!);

    expect(backtests[1].signal).toBeUndefined();
    expect(backtests[2].signal).toBe(Signal.Sell);
    expect(backtests[2].amount).toBe(2);
  });
});
