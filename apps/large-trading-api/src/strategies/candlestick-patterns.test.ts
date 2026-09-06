import { describe, expect, it, jest } from '@jest/globals';
import {
  Bar,
  BarCandlestickPatterns,
  Exchange,
  Signal,
  Timeframe
} from '@shared';
import CandlestickPatternsController from '../patterns/candlestick-patterns';
import CandlestickPatterns from './candlestick-patterns';

function createBar(): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: 0 },
    prices: { open: 100, high: 100, low: 100, close: 100 },
    volume: 0,
    backtest: { signals: [] }
  };
}

function runStrategy(newPatterns: BarCandlestickPatterns): { bar: Bar, state: any } {
  jest.spyOn(CandlestickPatternsController.prototype, 'stepCandlestickPatterns')
    .mockReturnValueOnce(newPatterns);
  const bar: Bar = createBar();
  const state: any = {};

  new CandlestickPatterns().stepSetSignals([bar], state, { minScore: 1 });

  return { bar, state };
}

describe('candlestick patterns strategy', () => {
  it('keeps the bar active and sizes a bullish signal by the absolute net score', () => {
    const { bar, state } = runStrategy({ hammer: true, invertedHammer: true });

    expect(bar.backtest.signals).toHaveLength(1);

    expect(bar.backtest.signals[0]).toEqual(expect.objectContaining({
      signal: Signal.Buy,
      size: 2
    }));

    expect(state.barDone).toBeUndefined();
  });

  it('keeps the bar active and sizes a bearish signal by the absolute net score', () => {
    const { bar, state } = runStrategy({ hangingMan: true, shootingStar: true });

    expect(bar.backtest.signals).toHaveLength(1);

    expect(bar.backtest.signals[0]).toEqual(expect.objectContaining({
      signal: Signal.Sell,
      size: 2
    }));

    expect(state.barDone).toBeUndefined();
  });
});