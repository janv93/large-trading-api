import { describe, expect, it, fit, beforeEach } from '@jest/globals';
import Backtester from './backtester';
import { Kline, Algorithm, Signal, Timeframe, BacktestData } from '../../../../interfaces';


describe('Backtester', () => {
  let backtester: Backtester;
  const algorithm = Algorithm.Dca;

  beforeEach(() => {
    backtester = new Backtester();
  });

  it('should calculate percentProfit correctly with flowing profit and no commission', () => {
    const base = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 1 };

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
      { // 4
        ...base,
        prices: { ...basePrices, close: 450 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.CloseSell } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 900 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Close } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 0 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy, amount: 10, signalPrice: 100 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 0 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Sell, amount: 10, signalPrice: 200 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Close } }
      },
      { // 9
        ...base,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy, amount: 2 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy, amount: 2 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 400 },
        algorithms: { [Algorithm.Dca]: {} }
      },
      {
        ...base,
        prices: { ...basePrices, close: 400 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Sell, amount: 2 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Close } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: {} }
      }
    ];

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0, true);
    const backtests: BacktestData[] = klinesWithProfit.map(k => k.algorithms[algorithm]!);

    expect(backtests[0].percentProfit).toBe(0);
    expect(backtests[1].percentProfit).toBe(100);
    expect(backtests[2].percentProfit).toBe(100);
    expect(backtests[3].percentProfit).toBe(50);
    expect(backtests[4].percentProfit).toBe(100);
    expect(backtests[5].percentProfit).toBe(0);
    // with amount + signalPrice
    expect(backtests[6].percentProfit).toBe(0);
    expect(backtests[7].percentProfit).toBe(1000);
    expect(backtests[8].percentProfit).toBe(500);
    // multiple positions at once
    expect(backtests[9].percentProfit).toBe(500);
    expect(backtests[10].percentProfit).toBe(700);
    expect(backtests[11].percentProfit).toBe(1300);
    expect(backtests[12].percentProfit).toBe(1300);
    expect(backtests[13].percentProfit).toBe(800);
    expect(backtests[14].percentProfit).toBe(800);
  });

  it('should calculate percentProfit correctly with flowing profit and commission', () => {
    const base = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 1 };

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
      { // 4
        ...base,
        prices: { ...basePrices, close: 450 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.CloseSell } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 900 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Close } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 0 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy, amount: 10, signalPrice: 100 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 0 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Sell, amount: 10, signalPrice: 200 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Close } }
      },
      { // 9
        ...base,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy, amount: 2 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy, amount: 2 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 400 },
        algorithms: { [Algorithm.Dca]: {} }
      },
      {
        ...base,
        prices: { ...basePrices, close: 400 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Sell, amount: 2 } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Close } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: {} }
      }
    ];

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0.1, true);
    const backtests: BacktestData[] = klinesWithProfit.map(k => k.algorithms[algorithm]!);

    expect(backtests[0].percentProfit).toBeCloseTo(-0.1);
    expect(backtests[1].percentProfit).toBeCloseTo(99.7);
    expect(backtests[2].percentProfit).toBeCloseTo(99.6);
    expect(backtests[3].percentProfit).toBeCloseTo(49.45);
    expect(backtests[4].percentProfit).toBeCloseTo(99.2);
    expect(backtests[5].percentProfit).toBeCloseTo(-0.8);
    // with amount + signalPrice
    expect(backtests[6].percentProfit).toBeCloseTo(-1.8);
    expect(backtests[7].percentProfit).toBeCloseTo(997.2);
    expect(backtests[8].percentProfit).toBeCloseTo(496.7);
    // multiple positions at once
    expect(backtests[9].percentProfit).toBeCloseTo(496.5);
    expect(backtests[10].percentProfit).toBeCloseTo(696.3);
    expect(backtests[11].percentProfit).toBeCloseTo(1296.3);
    expect(backtests[12].percentProfit).toBeCloseTo(1296.1);
    expect(backtests[13].percentProfit).toBeCloseTo(795.6);
    expect(backtests[14].percentProfit).toBeCloseTo(795.6);
  });

  it('should calculate percentProfit correctly in case of liquidation', () => {
    const base = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    const klines: Kline[] = [
      {
        ...base,
        prices: { ...basePrices, close: 100, high: 120, low: 80 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Sell } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 150, high: 200, low: 120 },
        algorithms: { [Algorithm.Dca]: {} }
      },
      {
        ...base,
        prices: { ...basePrices, close: 300, high: 400, low: 250 },
        algorithms: { [Algorithm.Dca]: { signal: Signal.Buy } }
      },
      {
        ...base,
        prices: { ...basePrices, close: 50, high: 100, low: 0 },
        algorithms: { [Algorithm.Dca]: {} }
      }
    ];

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0, true);
    const backtests: BacktestData[] = klinesWithProfit.map(k => k.algorithms[algorithm]!);

    expect(backtests[0].percentProfit).toBe(0);
    expect(backtests[1].percentProfit).toBe(-100);
    expect(backtests[2].percentProfit).toBe(-100);
    expect(backtests[3].percentProfit).toBe(-200);
  });
});
