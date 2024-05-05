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
    const algorithm = Algorithm.Dca;
    const symbol = 'BTCUSDT';
    const timeframe = Timeframe._1Day;
    const times = { open: 0, close: 0 };

    const klines: Kline[] = [
      {
        symbol,
        timeframe,
        times,
        prices: {
          open: 100,
          close: 100,
          high: 100,
          low: 100
        },
        volume: 3096.291,
        algorithms: {
          [algorithm]: {
            signal: Signal.Buy
          }
        }
      },
      {
        symbol,
        timeframe,
        times,
        prices: {
          open: 200,
          close: 200,
          high: 200,
          low: 200
        },
        volume: 14824.373,
        algorithms: {
          [algorithm]: {}
        }
      }
    ];

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0, true);
    expect(klinesWithProfit[0].algorithms[algorithm]!.percentProfit).toBe(0);
    expect(klinesWithProfit[1].algorithms[algorithm]!.percentProfit).toBe(100);
  });
});
