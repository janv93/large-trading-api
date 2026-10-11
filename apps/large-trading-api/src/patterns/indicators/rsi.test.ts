import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, Timeframe } from '@shared';
import { stepRsi } from './rsi';

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

describe('stepRsi', () => {
  it('waits for the initial price changes and preserves historical RSI values', () => {
    const bars: Bar[] = [];
    const prices: number[] = [100, 102, 101, 103, 102];
    const expected: (number | undefined)[] = [undefined, undefined, 66.6666666667, 85.7142857143, 54.5454545455];

    prices.forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      stepRsi(bars, 2);

      if (expected[index] === undefined) {
        expect(bars.at(-1)!.indicators?.rsi).toBeUndefined();
      } else {
        expect(bars.at(-1)!.indicators?.rsi?.value).toBeCloseTo(expected[index]!, 6);
      }
    });

    expect(bars[2].indicators?.rsi?.value).toBeCloseTo(expected[2]!, 6);
    expect(bars[3].indicators?.rsi?.value).toBeCloseTo(expected[3]!, 6);
  });

  it('recalculates the initial averages while their last bar is ongoing', () => {
    const bars: Bar[] = [createBar(0, 100), createBar(60_000, 102), createBar(120_000, 101)];
    stepRsi(bars, 2);
    expect(bars.at(-1)!.indicators?.rsi?.value).toBeCloseTo(66.6666666667, 6);
    expect(bars.at(-1)!.indicators?.rsi).toMatchObject({ avgGain: 1, avgLoss: 0.5 });

    bars.at(-1)!.prices.close = 100;
    stepRsi(bars, 2);
    expect(bars.at(-1)!.indicators?.rsi).toEqual({ value: 50, avgGain: 1, avgLoss: 1 });

    stepRsi(bars, 2);
    expect(bars.at(-1)!.indicators?.rsi).toEqual({ value: 50, avgGain: 1, avgLoss: 1 });
  });

  it('uses the previous completed averages for each tick and advances only with a new bar', () => {
    const bars: Bar[] = [createBar(0, 100), createBar(60_000, 102), createBar(120_000, 101)];
    stepRsi(bars, 2);
    bars.push(createBar(180_000, 103));

    const prices: number[] = [103, 103, 100, 104];
    const expected: number[] = [85.7142857143, 85.7142857143, 40, 88.8888888889];

    prices.forEach((price, index) => {
      bars.at(-1)!.prices.close = price;
      stepRsi(bars, 2);
      expect(bars.at(-1)!.indicators?.rsi?.value).toBeCloseTo(expected[index], 6);
      expect(bars.at(-2)!.indicators?.rsi?.value).toBeCloseTo(66.6666666667, 6);
      expect(bars.at(-2)!.indicators?.rsi).toMatchObject({ avgGain: 1, avgLoss: 0.5 });
    });

    bars.push(createBar(240_000, 103));
    stepRsi(bars, 2);
    expect(bars.at(-1)!.indicators?.rsi?.value).toBeCloseTo(61.5384615385, 6);
    expect(bars.at(-1)!.indicators?.rsi).toMatchObject({ avgGain: 1, avgLoss: 0.625 });
    expect(bars.at(-2)!.indicators?.rsi?.value).toBeCloseTo(88.8888888889, 6);
    expect(bars.at(-2)!.indicators?.rsi).toMatchObject({ avgGain: 2, avgLoss: 0.25 });
  });

  it.each([
    { prices: [100, 101, 102], expected: 100 },
    { prices: [100, 99, 98], expected: 0 },
    { prices: [100, 100, 100], expected: 100 },
  ])('preserves boundary values and other indicators for $prices', ({ prices, expected }) => {
    const bars: Bar[] = prices.map((price, index) => createBar(index * 60_000, price));
    bars.at(-1)!.indicators = { ema: { 3: 100 }, atr: 2 };

    stepRsi(bars, 2);

    expect(bars.at(-1)!.indicators).toMatchObject({ ema: { 3: 100 }, atr: 2, rsi: { value: expected } });
  });
});
