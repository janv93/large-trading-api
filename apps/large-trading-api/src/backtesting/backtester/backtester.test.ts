import { describe, expect, it, beforeEach } from '@jest/globals';
import Backtester from './backtester';
import { Bar, Exchange, Signal, Timeframe, BacktestData, BacktesterState } from '@shared';


describe('Backtester', () => {
  let backtester: Backtester;

  beforeEach(() => {
    backtester = new Backtester();
  });

  const runStep = (bars: Bar[], commission: number): BacktesterState => {
    const state: BacktesterState = {};
    const window: Bar[] = [];

    for (let i = 0; i < bars.length; i++) {
      window.push(bars[i]);
      backtester.stepCalcBacktestPerformance(window, state, commission);
    }

    return state;
  };

  it('should calculate profit correctly without commission', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 1, close: 0 };

    const bars: Bar[] = [
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 200 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.Sell, price: 200, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 300 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 300 }, { signal: Signal.Buy, price: 300, size: 1 }] }
      },
      { // 4
        ...baseBar,
        prices: { ...basePrices, close: 450 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 450 }, { signal: Signal.Sell, price: 450, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 900 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 900 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 10 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.Sell, price: 200, size: 10 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 100 }] }
      },
      { // 9
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 2 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.Buy, price: 200, size: 2 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 400 },
        backtest: { signals: [] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 400 },
        backtest: { signals: [{ signal: Signal.Sell, price: 400, size: 2 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 200 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [] }
      }
    ];

    runStep(bars, 0);
    const backtests: BacktestData[] = bars.map(k => k.backtest!);

    expect(backtests[0].profit).toBe(0);
    expect(backtests[1].profit).toBe(1);
    expect(backtests[2].profit).toBe(1);
    expect(backtests[3].profit).toBe(0.5);
    expect(backtests[4].profit).toBe(1);
    expect(backtests[5].profit).toBe(0);
    // with amount + signalPrice
    expect(backtests[6].profit).toBe(0);
    expect(backtests[7].profit).toBe(10);
    expect(backtests[8].profit).toBe(5);
    // multiple positions at once
    expect(backtests[9].profit).toBe(5);
    expect(backtests[10].profit).toBe(7);
    expect(backtests[11].profit).toBe(13);
    expect(backtests[12].profit).toBe(13);
    expect(backtests[13].profit).toBe(8);
    expect(backtests[14].profit).toBe(8);
  });

  it('should calculate profit correctly with commission', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 1 };

    const bars: Bar[] = [
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 200, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.Sell, price: 200, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 300 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 300 }, { signal: Signal.Buy, price: 300, size: 1 }] }
      },
      { // 4
        ...baseBar,
        prices: { ...basePrices, close: 450 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 450 }, { signal: Signal.Sell, price: 450, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 900 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 900 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 10 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.Sell, price: 200, size: 10 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 100 }] }
      },
      { // 9
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 2 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.Buy, price: 200, size: 2 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 400 },
        backtest: { signals: [] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 400 },
        backtest: { signals: [{ signal: Signal.Sell, price: 400, size: 2 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 200 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [] }
      }
    ];

    runStep(bars, 0.001);
    const backtests: BacktestData[] = bars.map(k => k.backtest!);

    expect(backtests[0].profit).toBeCloseTo(-0.001);
    expect(backtests[1].profit).toBeCloseTo(0.997);
    expect(backtests[2].profit).toBeCloseTo(0.996);
    expect(backtests[3].profit).toBeCloseTo(0.4945);
    expect(backtests[4].profit).toBeCloseTo(0.992);
    expect(backtests[5].profit).toBeCloseTo(-0.008);
    // with amount + signalPrice
    expect(backtests[6].profit).toBeCloseTo(-0.018);
    expect(backtests[7].profit).toBeCloseTo(9.972);
    expect(backtests[8].profit).toBeCloseTo(4.947);
    // multiple positions at once
    expect(backtests[9].profit).toBeCloseTo(4.945);
    expect(backtests[10].profit).toBeCloseTo(6.943);
    expect(backtests[11].profit).toBeCloseTo(12.943);
    expect(backtests[12].profit).toBeCloseTo(12.941);
    expect(backtests[13].profit).toBeCloseTo(7.932);
    expect(backtests[14].profit).toBeCloseTo(7.932);
  });

  it('should calculate profit correctly in case of liquidation', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    const bars: Bar[] = [
      {
        ...baseBar,
        prices: { ...basePrices, close: 100, high: 120, low: 80 },
        backtest: { signals: [{ signal: Signal.Sell, price: 100, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 150, high: 150, low: 80 },
        backtest: { signals: [] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 150, high: 200, low: 120 },
        backtest: { signals: [] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 300, high: 400, low: 250 },
        backtest: { signals: [{ signal: Signal.Buy, price: 300, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 50, high: 100, low: 0 },
        backtest: { signals: [] }
      }
    ];

    runStep(bars, 0);
    const backtests: BacktestData[] = bars.map(k => k.backtest!);

    expect(backtests[0].profit).toBe(0);
    expect(backtests[1].profit).toBe(-0.5);
    expect(backtests[2].profit).toBe(-1);
    expect(backtests[3].profit).toBe(-1);
    expect(backtests[4].profit).toBe(-2);
  });

  it('should calculate profit correctly in case of shrinking short position', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 0 };

    const bars: Bar[] = [
      {
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.Sell, price: 100, size: 1 }] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 120 },
        backtest: { signals: [] }
      },
      {
        ...baseBar,
        prices: { ...basePrices, close: 140 },
        backtest: { signals: [] }
      }
    ];

    runStep(bars, 0);
    const backtests: BacktestData[] = bars.map(k => k.backtest!);

    expect(backtests[0].profit).toBe(0);
    expect(backtests[1].profit).toBe(-0.2);
    expect(backtests[2].profit).toBe(-0.4);
  });

  describe('should calculate profit correctly in case of tp/sl', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    it('long sl', () => {
      const barsBuySl: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 0, low: 0 },
          backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 110, high: 100, low: 100 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 89 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 80, high: 100, low: 80 },
          backtest: { signals: [] }
        }
      ];

      runStep(barsBuySl, 0);
      const backtestsBuySl: BacktestData[] = barsBuySl.map(k => k.backtest!);

      expect(backtestsBuySl[0].profit).toBeCloseTo(0);
      expect(backtestsBuySl[1].profit).toBeCloseTo(0.1);
      expect(backtestsBuySl[2].profit).toBeCloseTo(-0.1);
      expect(backtestsBuySl[2].signals[0].signal).toBe(Signal.StopLoss);
      expect(backtestsBuySl[3].profit).toBeCloseTo(-0.1);
    });

    it('long tp', () => {
      const barsBuyTp: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 0, low: 0 },
          backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 110, high: 100, low: 100 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 130, high: 130, low: 100 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 150, high: 150, low: 100 },
          backtest: { signals: [] }
        }
      ];

      runStep(barsBuyTp, 0);
      const backtestsBuyTp: BacktestData[] = barsBuyTp.map(k => k.backtest!);

      expect(backtestsBuyTp[0].profit).toBeCloseTo(0);
      expect(backtestsBuyTp[1].profit).toBeCloseTo(0.1);
      expect(backtestsBuyTp[2].profit).toBeCloseTo(0.2);
      expect(backtestsBuyTp[2].signals[0].signal).toBe(Signal.TakeProfit);
      expect(backtestsBuyTp[3].profit).toBeCloseTo(0.2);

    });

    it('short sl', () => {
      const barsSellSl: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 0, low: 0 },
          backtest: { signals: [{ signal: Signal.Sell, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 110, high: 110, low: 100 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 130, high: 130, low: 100 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 140, high: 140, low: 100 },
          backtest: { signals: [] }
        }
      ];

      runStep(barsSellSl, 0);
      const backtestsSellSl: BacktestData[] = barsSellSl.map(k => k.backtest!);

      expect(backtestsSellSl[0].profit).toBeCloseTo(0);
      expect(backtestsSellSl[1].profit).toBeCloseTo(-0.1);
      expect(backtestsSellSl[2].profit).toBeCloseTo(-0.1);
      expect(backtestsSellSl[2].signals[0].signal).toBe(Signal.StopLoss);
      expect(backtestsSellSl[3].profit).toBeCloseTo(-0.1);
    });

    it('short tp', () => {
      const barsSellTp: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 0, low: 0 },
          backtest: { signals: [{ signal: Signal.Sell, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 90, high: 100, low: 90 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 70, high: 100, low: 70 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 60, high: 100, low: 60 },
          backtest: { signals: [] }
        }
      ];

      runStep(barsSellTp, 0);
      const backtestsSellTp: BacktestData[] = barsSellTp.map(k => k.backtest!);

      expect(backtestsSellTp[0].profit).toBeCloseTo(0);
      expect(backtestsSellTp[1].profit).toBeCloseTo(0.1);
      expect(backtestsSellTp[2].profit).toBeCloseTo(0.2);
      expect(backtestsSellTp[2].signals[0].signal).toBe(Signal.TakeProfit);
      expect(backtestsSellTp[3].profit).toBeCloseTo(0.2);
    });
  });

  describe('should calculate profit correctly with trailing stop loss', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    it('long', () => {
      const barsLongTsl: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.1 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 120, high: 120, low: 100 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 150, high: 150, low: 120 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 130, high: 140, low: 130 },
          backtest: { signals: [] }
        }
      ];

      runStep(barsLongTsl, 0);
      const backtestsLongTsl: BacktestData[] = barsLongTsl.map(k => k.backtest!);

      expect(backtestsLongTsl[0].profit).toBeCloseTo(0);
      expect(backtestsLongTsl[1].profit).toBeCloseTo(0.2);
      expect(backtestsLongTsl[2].profit).toBeCloseTo(0.5);
      expect(backtestsLongTsl[3].profit).toBeCloseTo(0.35); // Stopped out at 135
      expect(backtestsLongTsl[3].signals[0].signal).toBe(Signal.StopLoss);


    });

    it('short', () => {
      const barsShortTsl: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          backtest: { signals: [{ signal: Signal.Sell, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.1 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 90, high: 90, low: 90 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 80, high: 80, low: 80 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 115, high: 115, low: 80 },
          backtest: { signals: [] }
        }
      ];

      runStep(barsShortTsl, 0);
      const backtestsShortTsl: BacktestData[] = barsShortTsl.map(k => k.backtest!);

      expect(backtestsShortTsl[0].profit).toBeCloseTo(0);
      expect(backtestsShortTsl[1].profit).toBeCloseTo(0.1);
      expect(backtestsShortTsl[2].profit).toBeCloseTo(0.2);
      expect(backtestsShortTsl[3].profit).toBeCloseTo(0.12);
      expect(backtestsShortTsl[3].signals[0].signal).toBe(Signal.StopLoss);
    });
  });

  describe('should calculate profit correctly with trailing stop loss and percentOfProfit', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    it('long triggered by percentOfProfit', () => {
      // long triggered by percentOfProfit
      const barsLongTslWithPercentOfProfit: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.1, percentOfProfit: 0.5 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 150, high: 150, low: 100 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 200, high: 200, low: 150 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 160, high: 200, low: 140 },
          backtest: { signals: [] }
        }
      ];

      runStep(barsLongTslWithPercentOfProfit, 0);
      const backtestsLongTslPercentOfProfit: BacktestData[] = barsLongTslWithPercentOfProfit.map(k => k.backtest!);

      expect(backtestsLongTslPercentOfProfit[0].profit).toBeCloseTo(0);
      expect(backtestsLongTslPercentOfProfit[1].profit).toBeCloseTo(0.5);
      expect(backtestsLongTslPercentOfProfit[2].profit).toBeCloseTo(1);
      expect(backtestsLongTslPercentOfProfit[3].profit).toBeCloseTo(0.5); // Stopped out at 150 (locked in 50% of profit)
      expect(backtestsLongTslPercentOfProfit[3].signals[0].signal).toBe(Signal.StopLoss);
    });

    it('short triggered by percentOfProfit', () => {
      // short triggered by percentOfProfit
      const barsShortTslWithPercentOfProfit: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          backtest: { signals: [{ signal: Signal.Sell, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.1, percentOfProfit: 0.5 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 85, high: 100, low: 85 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 50, high: 85, low: 50 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 70, high: 75, low: 50 },  // 75 is exactly half the profit, so stop loss is not triggered yet
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 76, high: 80, low: 70 },
          backtest: { signals: [] }
        }
      ];

      runStep(barsShortTslWithPercentOfProfit, 0);
      const backtestsShortTslPercentOfProfit: BacktestData[] = barsShortTslWithPercentOfProfit.map(k => k.backtest!);

      expect(backtestsShortTslPercentOfProfit[0].profit).toBeCloseTo(0);
      expect(backtestsShortTslPercentOfProfit[1].profit).toBeCloseTo(0.15);
      expect(backtestsShortTslPercentOfProfit[2].profit).toBeCloseTo(0.5);
      expect(backtestsShortTslPercentOfProfit[3].profit).toBeCloseTo(0.3);
      expect(backtestsShortTslPercentOfProfit[4].profit).toBeCloseTo(0.25);
      expect(backtestsShortTslPercentOfProfit[4].signals[0].signal).toBe(Signal.StopLoss);
    });


    it('long triggered by stop loss', () => {
      // long triggered by stopLoss
      const barsLongTslStopLossTriggersFirst: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 100 },
          backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tSl: { stopLoss: 0.01, percentOfProfit: 0.5 } } }] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 101, high: 101, low: 100 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 99 },
          backtest: { signals: [] }
        },
      ];

      runStep(barsLongTslStopLossTriggersFirst, 0);
      const backtestsLongStopLossTriggersFirst: BacktestData[] = barsLongTslStopLossTriggersFirst.map(k => k.backtest!);

      expect(backtestsLongStopLossTriggersFirst[0].profit).toBeCloseTo(0);
      expect(backtestsLongStopLossTriggersFirst[1].profit).toBeCloseTo(0.01);
      expect(backtestsLongStopLossTriggersFirst[2].profit).toBeCloseTo(-0.0001);
      expect(backtestsLongStopLossTriggersFirst[2].signals[0].signal).toBe(Signal.StopLoss);
    });
  });

  describe('should scale tp/sl by volatility when asVolatilityFactor is true', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0 };

    // bars 0–1 establish ATR=20 on price=100 → volatility=0.2 at end of bar 1.
    // The Buy signal on bar 2 uses tp/sl factors of 1, so effective tp=0.2 and sl=0.2,
    // giving tpPrice=120 and slPrice=80.

    it('long tp triggered', () => {
      const bars: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 90 },
          backtest: { signals: [] }
        },
        { // true range=20, volatility=20/100=0.2 at end of this bar
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 110, low: 90 },
          backtest: { signals: [] }
        },
        { // Buy: effective tp=1*0.2→tpPrice=120, sl=1*0.2→slPrice=80; no trigger this bar
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 105, low: 95 },
          backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 1, stopLoss: 1, asVolatilityFactor: true } } }] }
        },
        { // high=125 > tpPrice(120) → take profit triggers
          ...baseBar,
          prices: { ...basePrices, close: 125, high: 125, low: 95 },
          backtest: { signals: [] }
        }
      ];

      runStep(bars, 0);
      const backtests: BacktestData[] = bars.map(k => k.backtest!);

      expect(backtests[2].profit).toBeCloseTo(0);
      expect(backtests[3].profit).toBeCloseTo(0.2);
      expect(backtests[3].signals[0].signal).toBe(Signal.TakeProfit);
    });

    it('long sl triggered', () => {
      const bars: Bar[] = [
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 100, low: 90 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 110, low: 90 },
          backtest: { signals: [] }
        },
        {
          ...baseBar,
          prices: { ...basePrices, close: 100, high: 105, low: 95 },
          backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1, positionCloseTrigger: { tpSl: { takeProfit: 1, stopLoss: 1, asVolatilityFactor: true } } }] }
        },
        { // low=75 < slPrice(80) → stop loss triggers
          ...baseBar,
          prices: { ...basePrices, close: 75, high: 90, low: 75 },
          backtest: { signals: [] }
        }
      ];

      runStep(bars, 0);
      const backtests: BacktestData[] = bars.map(k => k.backtest!);

      expect(backtests[2].profit).toBeCloseTo(0);
      expect(backtests[3].profit).toBeCloseTo(-0.2);
      expect(backtests[3].signals[0].signal).toBe(Signal.StopLoss);
    });
  });

  it('should close only the targeted position when using Signal.Close', () => {
    const baseBar = { symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance, times: { open: 0 }, volume: 0 };
    const basePrices = { open: 0, high: 0, low: 1 };

    const bars: Bar[] = [
      { // 0: open position A
        ...baseBar,
        prices: { ...basePrices, close: 100 },
        backtest: { signals: [{ signal: Signal.Buy, price: 100, size: 1 }] }
      },
      { // 1: open position B
        ...baseBar,
        prices: { ...basePrices, close: 200 },
        backtest: { signals: [{ signal: Signal.Buy, price: 200, size: 1 }] }
      },
      { // 2: close only position A (targeting barIndex:0, signalIndex:0) — position B stays open
        ...baseBar,
        prices: { ...basePrices, close: 300 },
        backtest: { signals: [{ signal: Signal.Close, price: 300, openSignalReferences: [{ barIndex: 0, signalIndex: 0 }] }] }
      },
      { // 3: close remaining position B
        ...baseBar,
        prices: { ...basePrices, close: 400 },
        backtest: { signals: [{ signal: Signal.CloseAll, price: 400 }] }
      }
    ];

    const state: BacktesterState = runStep(bars, 0);
    const backtests: BacktestData[] = bars.map(k => k.backtest!);

    expect(backtests[0].profit).toBe(0);    // A just opened
    expect(backtests[1].profit).toBe(1);    // A unrealised: 100→200 (+100%)
    expect(backtests[2].profit).toBe(2.5);  // A closed (200→300, +100%) + B unrealised (200→300, +50%)
    expect(backtests[2].openPositionSize).toBeCloseTo(1.5); // only B remains open (size = 1 * (1 + 0.5))
    expect(backtests[3].profit).toBe(3);    // B closed (300→400, +50%)
    expect(backtests[3].openPositionSize).toBe(0);
    expect(state.positions!.map(position => position.closeSignalReference)).toEqual([
      { barIndex: 2, signalIndex: 0 },
      { barIndex: 3, signalIndex: 0 }
    ]);
  });

  it('keeps one position per opening reference while repeatedly evaluating the same bar', () => {
    const bar: Bar = {
      symbol: 'BTCUSDT',
      timeframe: Timeframe._1Day,
      exchange: Exchange.Binance,
      times: { open: 0 },
      prices: { open: 100, high: 100, low: 100, close: 100 },
      volume: 0,
      backtest: {
        signals: [{
          signal: Signal.Buy,
          price: 100,
          size: 1,
          positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } }
        }]
      }
    };

    const state: BacktesterState = {};

    backtester.stepCalcBacktestPerformance([bar], state, 0.01);
    bar.prices = { open: 110, high: 110, low: 110, close: 110 };
    backtester.stepCalcBacktestPerformance([bar], state, 0.01);

    expect(state.positions).toHaveLength(1);
    expect(state.positions![0].closed).toBe(false);
    expect(bar.backtest.profit).toBeCloseTo(0.09);

    bar.prices = { open: 89, high: 89, low: 89, close: 89 };
    backtester.stepCalcBacktestPerformance([bar], state, 0.01);
    bar.prices = { open: 100, high: 100, low: 100, close: 100 };
    backtester.stepCalcBacktestPerformance([bar], state, 0.01);

    expect(state.positions).toHaveLength(1);
    expect(state.positions![0].closed).toBe(true);
    expect(state.positions![0].closeSignalReference).toEqual({ barIndex: 0, signalIndex: 1 });
    expect(bar.backtest.openPositionSize).toBe(0);
  });

  it('replaces CloseAll with targeted closes before opening replacement positions', () => {
    const first: Bar = {
      symbol: 'BTCUSDT', timeframe: Timeframe._1Day, exchange: Exchange.Binance,
      times: { open: 0 }, prices: { open: 100, high: 100, low: 100, close: 100 }, volume: 0,
      backtest: {
        signals: [
          { signal: Signal.Buy, price: 100, size: 1 },
          { signal: Signal.Buy, price: 100, size: 1 }
        ]
      }
    };
    const second: Bar = {
      ...first,
      times: { open: 1 }, prices: { open: 110, high: 110, low: 110, close: 110 },
      backtest: { signals: [{ signal: Signal.CloseAll, price: 110 }, { signal: Signal.Buy, price: 110, size: 1 }] }
    };

    const state: BacktesterState = {};

    backtester.stepCalcBacktestPerformance([first], state, 0);
    backtester.stepCalcBacktestPerformance([first, second], state, 0);
    second.prices = { open: 120, high: 120, low: 120, close: 120 };
    backtester.stepCalcBacktestPerformance([first, second], state, 0);

    expect(second.backtest.signals.map(signal => signal.signal)).toEqual([
      Signal.Close, Signal.Close, Signal.Buy
    ]);
    expect(second.backtest.signals.slice(0, 2).map(signal => signal.openSignalReferences)).toEqual([
      [{ barIndex: 0, signalIndex: 0 }],
      [{ barIndex: 0, signalIndex: 1 }]
    ]);
    expect(state.positions!.map(position => position.closed)).toEqual([true, true, false]);
  });

});
