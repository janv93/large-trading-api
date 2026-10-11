import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, MacdValues, Timeframe } from '@shared';
import { stepMacd } from './macd';

function createBar(openTime: number, price: number): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: openTime },
    prices: { open: price, high: price, low: price, close: price },
    volume: 100,
    backtest: { signals: [] },
  };
}

function stepLegacyEma(values: number[], state: any, period: number): number | undefined {
  const index: number = values.length - 1;
  if (index < period - 1) return undefined;

  if (state.currentEma === undefined) {
    state.currentEma = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  } else {
    const smoothingFactor: number = 2 / (period + 1);
    state.currentEma = (values[index] - state.currentEma) * smoothingFactor + state.currentEma;
  }

  return state.currentEma;
}

function calculateLegacyMacd(prices: number[], fast: number, slow: number, signal: number): (MacdValues | undefined)[] {
  const fastEma = {};
  const slowEma = {};
  const signalEma = {};
  const closesBuffer: number[] = [];
  const macdLineBuffer: number[] = [];

  return prices.map((price) => {
    closesBuffer.push(price);
    const fastEmaValue: number | undefined = stepLegacyEma(closesBuffer, fastEma, fast);
    const slowEmaValue: number | undefined = stepLegacyEma(closesBuffer, slowEma, slow);
    if (fastEmaValue === undefined || slowEmaValue === undefined) return undefined;

    const macdLine: number = fastEmaValue - slowEmaValue;
    macdLineBuffer.push(macdLine);
    const signalValue: number | undefined = stepLegacyEma(macdLineBuffer, signalEma, signal);
    if (signalValue === undefined) return undefined;

    return { macdLine, signal: signalValue, histogram: macdLine - signalValue };
  });
}

describe('stepMacd', () => {
  it.each([
    { fast: 12, slow: 26, signal: 9 },
    { fast: 26, slow: 12, signal: 9 },
    { fast: 2, slow: 3, signal: 2 },
    { fast: 5, slow: 5, signal: 3 },
    { fast: 1, slow: 3, signal: 1 },
    { fast: 3, slow: 1, signal: 4 },
    { fast: 1, slow: 1, signal: 1 },
  ])('exactly matches the old MACD and warm-up for $fast/$slow/$signal', ({ fast, slow, signal }) => {
    const pricePaths: number[][] = [
      Array.from({ length: 100 }, () => 100),
      Array.from({ length: 100 }, (_value, index) => index),
      Array.from({ length: 100 }, (_value, index) => 100 - index),
      Array.from({ length: 100 }, (_value, index) => 100 + index / 10 + Math.sin(index / 3) * 4 + (index % 7) / 10),
    ];

    for (const prices of pricePaths) {
      const expected: (MacdValues | undefined)[] = calculateLegacyMacd(prices, fast, slow, signal);
      const bars: Bar[] = [];
      const actual: (MacdValues | undefined)[] = [];

      prices.forEach((price, index) => {
        bars.push(createBar(index * 60_000, price));
        stepMacd(bars, fast, slow, signal);
        actual.push(bars.at(-1)!.indicators?.macd);
      });

      expect(actual).toEqual(expected);
      expect(actual.findIndex((value) => value !== undefined)).toBe(Math.max(fast, slow) + signal - 2);
    }
  });

  it('does not finish the fast and slow warm-up by counting repeated ticks as bars', () => {
    const bars: Bar[] = [];

    [100, 102].forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      stepMacd(bars, 2, 3, 1);
      expect(bars.at(-1)!.indicators?.macd).toBeUndefined();
    });

    for (const price of [102, 103, 104]) {
      bars.at(-1)!.prices.close = price;
      stepMacd(bars, 2, 3, 1);
      expect(bars.at(-1)!.indicators?.macd).toBeUndefined();
    }

    expect(bars.every((bar) => bar.indicators?.macd === undefined)).toBe(true);
  });

  it('calculates the MACD line from completed-bar EMAs on every tick', () => {
    const bars: Bar[] = [];

    [100, 102, 101].forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      stepMacd(bars, 2, 3, 1);
    });

    bars.push(createBar(180_000, 104));
    const prices: number[] = [104, 104, 101, 110];
    const expected: number[] = [0.5, 0.5, 0, 1.5];

    prices.forEach((price, index) => {
      bars.at(-1)!.prices.close = price;
      stepMacd(bars, 2, 3, 1);
      expect(bars.at(-1)!.indicators?.macd?.macdLine).toBe(expected[index]);
      expect(bars.at(-2)!.indicators?.macd?.macdLine).toBe(0);
    });

    bars.push(createBar(240_000, 110));
    stepMacd(bars, 2, 3, 1);
    expect(bars.at(-1)!.indicators?.macd?.macdLine).toBe(1.25);
  });

  it('does not finish the signal warm-up by counting repeated ticks as MACD bars', () => {
    const bars: Bar[] = [];

    [100, 102, 101].forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      stepMacd(bars, 2, 3, 3);
      expect(bars.at(-1)!.indicators?.macd).toBeUndefined();
    });

    for (const price of [101, 103, 100, 101]) {
      bars.at(-1)!.prices.close = price;
      stepMacd(bars, 2, 3, 3);
      expect(bars.at(-1)!.indicators?.macd).toBeUndefined();
    }

    bars.push(createBar(180_000, 104));
    stepMacd(bars, 2, 3, 3);
    expect(bars.at(-1)!.indicators?.macd).toBeUndefined();

    bars.push(createBar(240_000, 101));
    stepMacd(bars, 2, 3, 3);
    expect(bars.at(-1)!.indicators?.macd).toEqual(calculateLegacyMacd([100, 102, 101, 104, 101], 2, 3, 3).at(-1));
  });

  it('recalculates the signal seed on each tick of the first signal bar', () => {
    const completedPrices: number[] = [100, 102, 101, 104];
    const bars: Bar[] = [];

    completedPrices.forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      stepMacd(bars, 2, 3, 3);
      expect(bars.at(-1)!.indicators?.macd).toBeUndefined();
    });

    bars.push(createBar(240_000, 105));

    for (const price of [105, 105, 100, 106]) {
      bars.at(-1)!.prices.close = price;
      stepMacd(bars, 2, 3, 3);
      expect(bars.at(-1)!.indicators?.macd).toEqual(calculateLegacyMacd([...completedPrices, price], 2, 3, 3).at(-1));
    }

    bars.push(createBar(300_000, 108));
    stepMacd(bars, 2, 3, 3);
    expect(bars.at(-1)!.indicators?.macd).toEqual(calculateLegacyMacd([...completedPrices, 106, 108], 2, 3, 3).at(-1));
  });

  it('uses the previous completed signal for every tick after warm-up', () => {
    const completedPrices: number[] = [100, 102, 101, 104, 105];
    const expectedHistory: (MacdValues | undefined)[] = calculateLegacyMacd(completedPrices, 2, 3, 2);
    const bars: Bar[] = [];

    completedPrices.forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      stepMacd(bars, 2, 3, 2);
    });

    bars.push(createBar(300_000, 101));

    for (const price of [101, 101, 110, 103]) {
      bars.at(-1)!.prices.close = price;
      stepMacd(bars, 2, 3, 2);
      expect(bars.at(-1)!.indicators?.macd).toEqual(calculateLegacyMacd([...completedPrices, price], 2, 3, 2).at(-1));
      expect(bars.at(-2)!.indicators?.macd).toEqual(expectedHistory.at(-1));
    }

    bars.push(createBar(360_000, 100));
    stepMacd(bars, 2, 3, 2);
    expect(bars.at(-1)!.indicators?.macd).toEqual(calculateLegacyMacd([...completedPrices, 103, 100], 2, 3, 2).at(-1));
  });
});
