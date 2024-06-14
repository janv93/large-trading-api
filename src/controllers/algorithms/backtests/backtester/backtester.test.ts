import { describe, expect, it, beforeEach } from '@jest/globals';
import Backtester from './backtester';
import { Kline, Algorithm, Signal, Timeframe, BacktestData } from '../../../../interfaces';


describe('Backtester', () => {
  let backtester: Backtester;
  const algorithm = Algorithm.Dca;

  beforeEach(() => {
    backtester = new Backtester();
  });

  it('should calculate percentProfit correctly with flowing profit and no commission', () => {
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 1, close: 0 };

    const klines: Kline[] = [
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 200 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 200, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 300 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 300 }, { signal: Signal.Buy, price: 300, size: 1 }] } }
      },
      { // 4
        ...baseKline,
        prices: { ...basePrices, close: 450 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 450 }, { signal: Signal.Sell, price: 450, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 900 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 900 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 10 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 200, size: 10 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 100 }] } }
      },
      { // 9
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 2 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 200, size: 2 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 400 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 400 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 400, size: 2 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 200 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
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
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 1 };

    const klines: Kline[] = [
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 200, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 200, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 300 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 300 }, { signal: Signal.Buy, price: 300, size: 1 }] } }
      },
      { // 4
        ...baseKline,
        prices: { ...basePrices, close: 450 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 450 }, { signal: Signal.Sell, price: 450, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 900 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 900 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 10 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 200, size: 10 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 100 }] } }
      },
      { // 9
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 2 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 200, size: 2 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 400 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 400 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 400, size: 2 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 200 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Close, price: 200 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
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
    expect(backtests[8].percentProfit).toBeCloseTo(494.7);
    // multiple positions at once
    expect(backtests[9].percentProfit).toBeCloseTo(494.5);
    expect(backtests[10].percentProfit).toBeCloseTo(694.3);
    expect(backtests[11].percentProfit).toBeCloseTo(1294.3);
    expect(backtests[12].percentProfit).toBeCloseTo(1294.1);
    expect(backtests[13].percentProfit).toBeCloseTo(793.2);
    expect(backtests[14].percentProfit).toBeCloseTo(793.2);
  });

  it('should calculate percentProfit correctly in case of liquidation', () => {
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    const klines: Kline[] = [
      {
        ...baseKline,
        prices: { ...basePrices, close: 100, high: 120, low: 80 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 100, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 150, high: 150, low: 80 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 150, high: 200, low: 120 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 300, high: 400, low: 250 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 300, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 50, high: 100, low: 0 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      }
    ];

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0, true);
    const backtests: BacktestData[] = klinesWithProfit.map(k => k.algorithms[algorithm]!);

    expect(backtests[0].percentProfit).toBe(0);
    expect(backtests[1].percentProfit).toBe(-50);
    expect(backtests[2].percentProfit).toBe(-100);
    expect(backtests[3].percentProfit).toBe(-100);
    expect(backtests[4].percentProfit).toBe(-200);
  });

  it('should calculate percentProfit correctly in case of shrinking short position', () => {
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 0 };

    const klines: Kline[] = [
      {
        ...baseKline,
        prices: { ...basePrices, close: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 100, size: 1 }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 120 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 140 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      }
    ];

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0, true);
    const backtests: BacktestData[] = klinesWithProfit.map(k => k.algorithms[algorithm]!);

    expect(backtests[0].percentProfit).toBe(0);
    expect(backtests[1].percentProfit).toBe(-20);
    expect(backtests[2].percentProfit).toBe(-40);
  });

  it('should calculate percentProfit correctly in case of tp/sl', () => {
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    const klinesBuySl: Kline[] = [
      {
        ...baseKline,
        prices: { ...basePrices, close: 100, high: 0, low: 0 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } } }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 110, high: 100, low: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 100, high: 100, low: 89 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 80, high: 100, low: 80 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      }
    ];

    const klinesWithProfitBuySl: Kline[] = backtester.calcBacktestPerformance(klinesBuySl, algorithm, 0, true);
    const backtestsBuySl: BacktestData[] = klinesWithProfitBuySl.map(k => k.algorithms[algorithm]!);

    expect(backtestsBuySl[0].percentProfit).toBeCloseTo(0);
    expect(backtestsBuySl[1].percentProfit).toBeCloseTo(10);
    expect(backtestsBuySl[2].percentProfit).toBeCloseTo(-10);
    expect(backtestsBuySl[2].signals[0].signal).toBe(Signal.StopLoss);
    expect(backtestsBuySl[3].percentProfit).toBeCloseTo(-10);

    const klinesBuyTp: Kline[] = [
      {
        ...baseKline,
        prices: { ...basePrices, close: 100, high: 0, low: 0 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } } }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 110, high: 100, low: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 130, high: 130, low: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 150, high: 150, low: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      }
    ];

    const klinesWithProfitBuyTp: Kline[] = backtester.calcBacktestPerformance(klinesBuyTp, algorithm, 0, true);
    const backtestsBuyTp: BacktestData[] = klinesWithProfitBuyTp.map(k => k.algorithms[algorithm]!);

    expect(backtestsBuyTp[0].percentProfit).toBeCloseTo(0);
    expect(backtestsBuyTp[1].percentProfit).toBeCloseTo(10);
    expect(backtestsBuyTp[2].percentProfit).toBeCloseTo(20);
    expect(backtestsBuyTp[2].signals[0].signal).toBe(Signal.TakeProfit);
    expect(backtestsBuyTp[3].percentProfit).toBeCloseTo(20);

    const klinesSellSl: Kline[] = [
      {
        ...baseKline,
        prices: { ...basePrices, close: 100, high: 0, low: 0 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } } }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 110, high: 110, low: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 130, high: 130, low: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 140, high: 140, low: 100 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      }
    ];

    const klinesWithProfitSellSl: Kline[] = backtester.calcBacktestPerformance(klinesSellSl, algorithm, 0, true);
    const backtestsSellSl: BacktestData[] = klinesWithProfitSellSl.map(k => k.algorithms[algorithm]!);

    expect(backtestsSellSl[0].percentProfit).toBeCloseTo(0);
    expect(backtestsSellSl[1].percentProfit).toBeCloseTo(-10);
    expect(backtestsSellSl[2].percentProfit).toBeCloseTo(-10);
    expect(backtestsSellSl[2].signals[0].signal).toBe(Signal.StopLoss);
    expect(backtestsSellSl[3].percentProfit).toBeCloseTo(-10);

    const klinesSellTp: Kline[] = [
      {
        ...baseKline,
        prices: { ...basePrices, close: 100, high: 0, low: 0 },
        algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } } }] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 90, high: 100, low: 90 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 70, high: 100, low: 70 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      },
      {
        ...baseKline,
        prices: { ...basePrices, close: 60, high: 100, low: 60 },
        algorithms: { [Algorithm.Dca]: { signals: [] } }
      }
    ];

    const klinesWithProfitSellTp: Kline[] = backtester.calcBacktestPerformance(klinesSellTp, algorithm, 0, true);
    const backtestsSellTp: BacktestData[] = klinesWithProfitSellTp.map(k => k.algorithms[algorithm]!);

    expect(backtestsSellTp[0].percentProfit).toBeCloseTo(0);
    expect(backtestsSellTp[1].percentProfit).toBeCloseTo(10);
    expect(backtestsSellTp[2].percentProfit).toBeCloseTo(20);
    expect(backtestsSellTp[2].signals[0].signal).toBe(Signal.TakeProfit);
    expect(backtestsSellTp[3].percentProfit).toBeCloseTo(20);
  });
});
