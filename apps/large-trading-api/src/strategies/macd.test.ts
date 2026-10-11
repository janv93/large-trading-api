import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, Signal, Timeframe } from '@shared';
import Macd from './macd';

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

describe('MACD strategy', () => {
  it.each([
    { prices: [100, 100, 100, 103], ticks: [109, 109, 108], positionOpen: false, positionOpenType: Signal.Buy },
    { prices: [100, 100, 100, 97], ticks: [91, 91, 92], positionOpen: false, positionOpenType: Signal.Sell },
    { prices: [100, 100, 100, 103], ticks: [109, 109, 108], positionOpen: true, positionOpenType: Signal.Buy },
    { prices: [100, 100, 100, 97], ticks: [91, 91, 92], positionOpen: true, positionOpenType: Signal.Sell },
  ])(
    'ignores a tick reversal for $positionOpenType with positionOpen=$positionOpen',
    ({ prices, ticks, positionOpen, positionOpenType }) => {
      const strategy = new Macd();
      const state = { positionOpen, positionOpenType };
      const params = { fast: 1, slow: 2, signal: 2 };
      const bars: Bar[] = [];

      prices.forEach((price, index) => {
        bars.push(createBar(index * 60_000, price));
        strategy.stepSetSignals(bars, state, params);
        expect(bars.at(-1)!.backtest.signals).toEqual([]);
      });

      bars.push(createBar(240_000, ticks[0]));

      for (const price of ticks) {
        bars.at(-1)!.prices = { open: price, high: price, low: price, close: price };
        strategy.stepSetSignals(bars, state, params);
        expect(bars.at(-1)!.backtest.signals).toEqual([]);
        expect(state.positionOpen).toBe(positionOpen);
        expect(state.positionOpenType).toBe(positionOpenType);
      }
    },
  );

  it('waits for two completed histograms instead of counting ticks toward warm-up', () => {
    const strategy = new Macd();
    const state = {};
    const params = { fast: 1, slow: 2, signal: 2 };
    const bars: Bar[] = [];

    [100, 100].forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      strategy.stepSetSignals(bars, state, params);
    });

    bars.push(createBar(120_000, 102));

    for (const price of [102, 104, 103]) {
      bars.at(-1)!.prices = { open: price, high: price, low: price, close: price };
      strategy.stepSetSignals(bars, state, params);
      expect(bars.at(-1)!.backtest.signals).toEqual([]);
    }

    bars.push(createBar(180_000, 106));

    for (const price of [106, 109, 108]) {
      bars.at(-1)!.prices = { open: price, high: price, low: price, close: price };
      strategy.stepSetSignals(bars, state, params);
      expect(bars.at(-1)!.backtest.signals).toEqual([]);
    }
  });

  it.each([1, -1])('preserves historical entries and exits for price direction %s', (direction) => {
    const strategy = new Macd();
    const state: any = {};
    const params = { fast: 1, slow: 2, signal: 2 };
    const bars: Bar[] = [];
    const prices: number[] = [100, 100, 100, 103, 109, 115, 100, 98, 90, 84, 100, 105];
    const firstEntry: Signal = direction === 1 ? Signal.Sell : Signal.Buy;
    const secondEntry: Signal = direction === 1 ? Signal.Buy : Signal.Sell;
    const expected: Signal[][] = [
      [],
      [],
      [],
      [],
      [],
      [Signal.CloseAll, firstEntry],
      [],
      [Signal.CloseAll],
      [],
      [Signal.CloseAll, secondEntry],
      [],
      [Signal.CloseAll],
    ];

    prices.forEach((price, index) => {
      const closePrice: number = 100 + (price - 100) * direction;
      state.barDone = false;
      bars.push(createBar(index * 60_000, closePrice));
      strategy.stepSetSignals(bars, state, params);

      expect(bars.at(-1)!.backtest.signals.map((signal) => signal.signal)).toEqual(expected[index]);
      expect(bars.at(-1)!.backtest.signals.every((signal) => signal.price === closePrice)).toBe(true);
      expect(state.barDone).toBe(expected[index].length > 0);

      if (index === 5) {
        expect(state.positionOpen).toBe(true);
        expect(state.positionOpenType).toBe(firstEntry);
      }

      if (index === 7) expect(state.positionOpen).toBe(false);

      if (index === 9) {
        expect(state.positionOpen).toBe(true);
        expect(state.positionOpenType).toBe(secondEntry);
      }
    });

    expect(state.positionOpen).toBe(false);
  });

  it('does not open positions when histogram reversals remain below the entry threshold', () => {
    const strategy = new Macd();
    const state: any = {};
    const params = { fast: 1, slow: 2, signal: 2 };
    const bars: Bar[] = [];
    const prices: number[] = [100, 100, 100, 103, 109, 115, 100, 98, 90, 84, 100, 105];

    prices.forEach((price, index) => {
      bars.push(createBar(index * 60_000, 100 + (price - 100) * 0.001));
      strategy.stepSetSignals(bars, state, params);
      expect(bars.at(-1)!.backtest.signals).toEqual([]);
    });

    expect(state.positionOpen).toBeUndefined();
  });
});
