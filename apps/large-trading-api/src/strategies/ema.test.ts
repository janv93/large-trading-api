import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, Signal, Timeframe } from '@shared';
import Ema from './ema';

function createBar(openTime: number, price: number): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: openTime },
    prices: { open: price, high: price, low: price, close: price },
    volume: 0,
    backtest: { signals: [] },
  };
}

describe('EMA strategy', () => {
  it.each([false, true])('does not treat a tick pullback as a bar reversal when positionOpen is %s', (positionOpen) => {
    const strategy = new Ema();
    const state = { positionOpen };
    const params = { periodOpen: 1, periodClose: 1 };
    const bars: Bar[] = [];

    [99, 100].forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      strategy.stepSetSignals(bars, state, params);
    });

    bars.push(createBar(120_000, 105));
    strategy.stepSetSignals(bars, state, params);
    expect(bars.at(-1)!.backtest.signals).toEqual([]);

    bars.at(-1)!.prices = { open: 103, high: 103, low: 103, close: 103 };
    strategy.stepSetSignals(bars, state, params);

    expect(bars.at(-1)!.backtest.signals).toEqual([]);
    expect(state.positionOpen).toBe(positionOpen);
  });

  it('does not complete the warm-up by counting repeated ticks as additional bars', () => {
    const strategy = new Ema();
    const state = {};
    const params = { periodOpen: 2, periodClose: 3 };
    const bars: Bar[] = [];

    [100, 101].forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      strategy.stepSetSignals(bars, state, params);
    });

    bars.push(createBar(120_000, 102));

    for (const price of [102, 104, 102]) {
      bars.at(-1)!.prices = { open: price, high: price, low: price, close: price };
      strategy.stepSetSignals(bars, state, params);
      expect(bars.at(-1)!.backtest.signals).toEqual([]);
    }
  });

  it('preserves historical entry, exit, and reversal signals with different EMA periods', () => {
    const strategy = new Ema();
    const state: any = {};
    const params = { periodOpen: 1, periodClose: 2 };
    const bars: Bar[] = [];
    const prices: number[] = [100, 102, 104, 101, 99, 103, 98];
    const expected: Signal[][] = [
      [],
      [],
      [],
      [Signal.CloseAll, Signal.Sell],
      [],
      [Signal.CloseAll, Signal.CloseAll, Signal.Buy],
      [Signal.CloseAll, Signal.CloseAll, Signal.Sell],
    ];

    prices.forEach((price, index) => {
      state.barDone = false;
      bars.push(createBar(index * 60_000, price));
      strategy.stepSetSignals(bars, state, params);

      expect(bars.at(-1)!.backtest.signals.map((signal) => signal.signal)).toEqual(expected[index]);
      expect(bars.at(-1)!.backtest.signals.every((signal) => signal.price === price)).toBe(true);
      expect(state.barDone).toBe(expected[index].length > 0);
    });

    expect(state.positionOpen).toBe(true);
  });

  it('closes without reversing when only the closing EMA changes direction across bars', () => {
    const strategy = new Ema();
    const state: any = { positionOpen: true };
    const params = { periodOpen: 3, periodClose: 1 };
    const bars: Bar[] = [];

    [100, 102, 104, 106, 108].forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      strategy.stepSetSignals(bars, state, params);
      expect(bars.at(-1)!.backtest.signals).toEqual([]);
    });

    bars.push(createBar(300_000, 109));
    strategy.stepSetSignals(bars, state, params);
    expect(bars.at(-1)!.backtest.signals).toEqual([]);

    bars.at(-1)!.prices = { open: 107, high: 107, low: 107, close: 107 };
    strategy.stepSetSignals(bars, state, params);

    expect(bars.at(-1)!.backtest.signals).toEqual([{ signal: Signal.CloseAll, price: 107 }]);
    expect(state.positionOpen).toBe(false);
    expect(state.barDone).toBe(true);
  });
});
