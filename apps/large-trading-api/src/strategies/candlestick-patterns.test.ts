import { describe, expect, it, jest } from '@jest/globals';
import { Bar, BarCandlestickPatterns, BarPrices, Exchange, Signal, Timeframe } from '@shared';
import CandlestickPatternsController from '../patterns/candlestick-patterns';
import CandlestickPatterns from './candlestick-patterns';

function createBar(prices: BarPrices = { open: 100, high: 100, low: 100, close: 100 }): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: 0 },
    prices,
    volume: 0,
    backtest: { signals: [] },
  };
}

function runStrategy(patterns: BarCandlestickPatterns): { bar: Bar; state: any } {
  jest.spyOn(CandlestickPatternsController.prototype, 'stepCandlestickPatterns').mockImplementationOnce((bars: Bar[]) => {
    bars[bars.length - 2].candlestickPatterns = patterns;
  });

  const bar: Bar = createBar({ open: 105, high: 108, low: 103, close: 107 });
  const state: any = {};

  new CandlestickPatterns().stepSetSignals([createBar(), bar], state, { minScore: 1 });

  return { bar, state };
}

describe('candlestick patterns strategy', () => {
  it('marks the bar done and sizes a bullish signal by the absolute net score at the bar open', () => {
    const { bar, state } = runStrategy({ hammer: true, invertedHammer: true });

    expect(bar.backtest.signals).toHaveLength(1);

    expect(bar.backtest.signals[0]).toEqual(
      expect.objectContaining({
        signal: Signal.Buy,
        size: 2,
        price: 105,
      }),
    );

    expect(state.barDone).toBe(true);
  });

  it('marks the bar done and sizes a bearish signal by the absolute net score at the bar open', () => {
    const { bar, state } = runStrategy({ hangingMan: true, shootingStar: true });

    expect(bar.backtest.signals).toHaveLength(1);

    expect(bar.backtest.signals[0]).toEqual(
      expect.objectContaining({
        signal: Signal.Sell,
        size: 2,
        price: 105,
      }),
    );

    expect(state.barDone).toBe(true);
  });

  it('detects patterns ending at the previous candle and ignores the current one', () => {
    const firstBar: Bar = createBar({ open: 100, high: 110, low: 100, close: 110 });
    const completedBar: Bar = createBar({ open: 111, high: 111, low: 99, close: 99 });
    const currentBar: Bar = createBar({ open: 98, high: 120, low: 98, close: 120 });
    const state: any = {};

    new CandlestickPatterns().stepSetSignals([firstBar, completedBar, currentBar], state, { minScore: 1 });

    expect(completedBar.candlestickPatterns).toEqual({ bearishMarubozu: true, bearishEngulfing: true });
    expect(currentBar.candlestickPatterns).toBeUndefined();

    expect(currentBar.backtest.signals).toEqual([
      expect.objectContaining({
        signal: Signal.Sell,
        size: 2,
        price: 98,
      }),
    ]);

    expect(state.barDone).toBe(true);
  });

  it('does not count a candle that closes at its open as rising', () => {
    const fallingBar: Bar = createBar({ open: 110, high: 110, low: 100, close: 100 });
    const dojiBar: Bar = createBar({ open: 105, high: 106, low: 104, close: 105 });
    const bars: Bar[] = [fallingBar, dojiBar, createBar()];

    new CandlestickPatterns().stepSetSignals(bars, {}, { minScore: 1 });

    expect(dojiBar.candlestickPatterns).toEqual({ doji: true });
    expect(bars[2].backtest.signals).toEqual([]);
  });

  it('marks the bar done even when the previous candle has no pattern', () => {
    const bars: Bar[] = [createBar(), createBar()];
    const state: any = {};

    new CandlestickPatterns().stepSetSignals(bars, state, { minScore: 1 });

    expect(bars[1].backtest.signals).toEqual([]);
    expect(state.barDone).toBe(true);
  });
});
