import { describe, expect, it, beforeEach, fit } from '@jest/globals';
import Backtester from './backtester';
import { Kline, Algorithm, Signal, Timeframe, BacktestData } from '../../../../interfaces';


describe('Backtester', () => {
  let backtester: Backtester;
  const algorithm = Algorithm.Dca;

  beforeEach(() => {
    backtester = new Backtester();
  });

  it('should calculate percentProfit correctly without commission', () => {
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

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0);
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

  it('should calculate percentProfit correctly with commission', () => {
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

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0.1);
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

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0);
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

    const klinesWithProfit: Kline[] = backtester.calcBacktestPerformance(klines, algorithm, 0);
    const backtests: BacktestData[] = klinesWithProfit.map(k => k.algorithms[algorithm]!);

    expect(backtests[0].percentProfit).toBe(0);
    expect(backtests[1].percentProfit).toBe(-20);
    expect(backtests[2].percentProfit).toBe(-40);
  });

  describe('should calculate percentProfit correctly in case of tp/sl', () => {
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    it('long sl', () => {
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

      const klinesWithProfitBuySl: Kline[] = backtester.calcBacktestPerformance(klinesBuySl, algorithm, 0);
      const backtestsBuySl: BacktestData[] = klinesWithProfitBuySl.map(k => k.algorithms[algorithm]!);

      expect(backtestsBuySl[0].percentProfit).toBeCloseTo(0);
      expect(backtestsBuySl[1].percentProfit).toBeCloseTo(10);
      expect(backtestsBuySl[2].percentProfit).toBeCloseTo(-10);
      expect(backtestsBuySl[2].signals[0].signal).toBe(Signal.StopLoss);
      expect(backtestsBuySl[3].percentProfit).toBeCloseTo(-10);
    });

    it('long tp', () => {
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

      const klinesWithProfitBuyTp: Kline[] = backtester.calcBacktestPerformance(klinesBuyTp, algorithm, 0);
      const backtestsBuyTp: BacktestData[] = klinesWithProfitBuyTp.map(k => k.algorithms[algorithm]!);

      expect(backtestsBuyTp[0].percentProfit).toBeCloseTo(0);
      expect(backtestsBuyTp[1].percentProfit).toBeCloseTo(10);
      expect(backtestsBuyTp[2].percentProfit).toBeCloseTo(20);
      expect(backtestsBuyTp[2].signals[0].signal).toBe(Signal.TakeProfit);
      expect(backtestsBuyTp[3].percentProfit).toBeCloseTo(20);

    });

    it('short sl', () => {
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

      const klinesWithProfitSellSl: Kline[] = backtester.calcBacktestPerformance(klinesSellSl, algorithm, 0);
      const backtestsSellSl: BacktestData[] = klinesWithProfitSellSl.map(k => k.algorithms[algorithm]!);

      expect(backtestsSellSl[0].percentProfit).toBeCloseTo(0);
      expect(backtestsSellSl[1].percentProfit).toBeCloseTo(-10);
      expect(backtestsSellSl[2].percentProfit).toBeCloseTo(-10);
      expect(backtestsSellSl[2].signals[0].signal).toBe(Signal.StopLoss);
      expect(backtestsSellSl[3].percentProfit).toBeCloseTo(-10);
    });

    it('short tp', () => {
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

      const klinesWithProfitSellTp: Kline[] = backtester.calcBacktestPerformance(klinesSellTp, algorithm, 0);
      const backtestsSellTp: BacktestData[] = klinesWithProfitSellTp.map(k => k.algorithms[algorithm]!);

      expect(backtestsSellTp[0].percentProfit).toBeCloseTo(0);
      expect(backtestsSellTp[1].percentProfit).toBeCloseTo(10);
      expect(backtestsSellTp[2].percentProfit).toBeCloseTo(20);
      expect(backtestsSellTp[2].signals[0].signal).toBe(Signal.TakeProfit);
      expect(backtestsSellTp[3].percentProfit).toBeCloseTo(20);
    });
  });

  describe('should calculate percentProfit correctly with trailing stop loss', () => {
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    it('long', () => {
      const klinesLongTsl: Kline[] = [
        {
          ...baseKline,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.1 } } }] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 120, high: 120, low: 100 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 150, high: 150, low: 120 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 130, high: 140, low: 130 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        }
      ];

      const klinesWithProfitLongTsl: Kline[] = backtester.calcBacktestPerformance(klinesLongTsl, algorithm, 0);
      const backtestsLongTsl: BacktestData[] = klinesWithProfitLongTsl.map(k => k.algorithms[algorithm]!);

      expect(backtestsLongTsl[0].percentProfit).toBeCloseTo(0);
      expect(backtestsLongTsl[1].percentProfit).toBeCloseTo(20);
      expect(backtestsLongTsl[2].percentProfit).toBeCloseTo(50);
      expect(backtestsLongTsl[3].percentProfit).toBeCloseTo(35); // Stopped out at 135
      expect(backtestsLongTsl[3].signals[0].signal).toBe(Signal.StopLoss);


    });

    it('short', () => {
      const klinesShortTsl: Kline[] = [
        {
          ...baseKline,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.1 } } }] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 90, high: 90, low: 90 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 80, high: 80, low: 80 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 115, high: 115, low: 80 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        }
      ];

      const klinesWithProfitShortTsl: Kline[] = backtester.calcBacktestPerformance(klinesShortTsl, algorithm, 0);
      const backtestsShortTsl: BacktestData[] = klinesWithProfitShortTsl.map(k => k.algorithms[algorithm]!);

      expect(backtestsShortTsl[0].percentProfit).toBeCloseTo(0);
      expect(backtestsShortTsl[1].percentProfit).toBeCloseTo(10);
      expect(backtestsShortTsl[2].percentProfit).toBeCloseTo(20);
      expect(backtestsShortTsl[3].percentProfit).toBeCloseTo(12);
      expect(backtestsShortTsl[3].signals[0].signal).toBe(Signal.StopLoss);
    });
  });

  describe('should calculate percentProfit correctly with trailing stop loss and percentOfProfit', () => {
    const baseKline = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, times: { open: 0, close: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    it('long triggered by percentOfProfit', () => {
      // long triggered by percentOfProfit
      const klinesLongTslWithPercentProfit: Kline[] = [
        {
          ...baseKline,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.1, percentOfProfit: 0.5 } } }] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 150, high: 150, low: 100 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 200, high: 200, low: 150 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 160, high: 200, low: 140 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        }
      ];

      const klinesWithProfitLongTslPercentProfit: Kline[] = backtester.calcBacktestPerformance(klinesLongTslWithPercentProfit, algorithm, 0);
      const backtestsLongTslPercentProfit: BacktestData[] = klinesWithProfitLongTslPercentProfit.map(k => k.algorithms[algorithm]!);

      expect(backtestsLongTslPercentProfit[0].percentProfit).toBeCloseTo(0);
      expect(backtestsLongTslPercentProfit[1].percentProfit).toBeCloseTo(50);
      expect(backtestsLongTslPercentProfit[2].percentProfit).toBeCloseTo(100);
      expect(backtestsLongTslPercentProfit[3].percentProfit).toBeCloseTo(50); // Stopped out at 150 (locked in 50% of profit)
      expect(backtestsLongTslPercentProfit[3].signals[0].signal).toBe(Signal.StopLoss);
    });

    it('short triggered by percentOfProfit', () => {
      // short triggered by percentOfProfit
      const klinesShortTslWithPercentProfit: Kline[] = [
        {
          ...baseKline,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Sell, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.1, percentOfProfit: 0.5 } } }] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 85, high: 100, low: 85 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 50, high: 85, low: 50 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 70, high: 75, low: 50 },  // 75 is exactly half the profit, so stop loss is not triggered yet
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 76, high: 80, low: 70 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        }
      ];

      const klinesWithProfitShortTslPercentProfit: Kline[] = backtester.calcBacktestPerformance(klinesShortTslWithPercentProfit, algorithm, 0);
      const backtestsShortTslPercentProfit: BacktestData[] = klinesWithProfitShortTslPercentProfit.map(k => k.algorithms[algorithm]!);

      expect(backtestsShortTslPercentProfit[0].percentProfit).toBeCloseTo(0);
      expect(backtestsShortTslPercentProfit[1].percentProfit).toBeCloseTo(15);
      expect(backtestsShortTslPercentProfit[2].percentProfit).toBeCloseTo(50);
      expect(backtestsShortTslPercentProfit[3].percentProfit).toBeCloseTo(30);
      expect(backtestsShortTslPercentProfit[4].percentProfit).toBeCloseTo(25);
      expect(backtestsShortTslPercentProfit[4].signals[0].signal).toBe(Signal.StopLoss);
    });

    fit('long triggered by stop loss', () => {
      // long triggered by stopLoss
      const klinesLongTslStopLossTriggersFirst: Kline[] = [
        {
          ...baseKline,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          algorithms: { [Algorithm.Dca]: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.01, percentOfProfit: 0.5 } } }] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 101, high: 101, low: 100 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
        {
          ...baseKline,
          prices: { ...basePrices, close: 100, high: 100, low: 99 },
          algorithms: { [Algorithm.Dca]: { signals: [] } }
        },
      ];

      const klinesWithProfitLongStopLossTriggersFirst: Kline[] = backtester.calcBacktestPerformance(klinesLongTslStopLossTriggersFirst, algorithm, 0);
      const backtestsLongStopLossTriggersFirst: BacktestData[] = klinesWithProfitLongStopLossTriggersFirst.map(k => k.algorithms[algorithm]!);

      expect(backtestsLongStopLossTriggersFirst[0].percentProfit).toBeCloseTo(0);
      expect(backtestsLongStopLossTriggersFirst[1].percentProfit).toBeCloseTo(1);
      expect(backtestsLongStopLossTriggersFirst[2].percentProfit).toBeCloseTo(-0.01);
      expect(backtestsLongStopLossTriggersFirst[2].signals[0].signal).toBe(Signal.StopLoss);
    });
  });
});
