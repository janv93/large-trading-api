import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, Timeframe } from '@shared';
import { stepEma } from './ema';

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

describe('stepEma', () => {
  it('waits for the initial period and preserves historical EMA values', () => {
    const bars: Bar[] = [];
    const prices: number[] = [100, 104, 102, 110, 106];
    const expected: (number | undefined)[] = [undefined, undefined, 102, 106, 106];

    prices.forEach((price, index) => {
      bars.push(createBar(index * 60_000, price));
      stepEma(bars, 3);
      expect(bars.at(-1)!.indicators?.ema?.[3]).toBe(expected[index]);
    });

    expect(bars.map((bar) => bar.indicators?.ema?.[3])).toEqual(expected);
  });

  it('recalculates the initial average while its last bar is ongoing', () => {
    const bars: Bar[] = [createBar(0, 100), createBar(60_000, 100), createBar(120_000, 110)];
    stepEma(bars, 3);
    expect(bars.at(-1)!.indicators?.ema?.[3]).toBeCloseTo(310 / 3);

    bars.at(-1)!.prices.close = 120;
    stepEma(bars, 3);
    expect(bars.at(-1)!.indicators?.ema?.[3]).toBeCloseTo(320 / 3);
  });

  it('uses the previous completed EMA for every tick and advances only with a new bar', () => {
    const bars: Bar[] = [createBar(0, 100), createBar(60_000, 100), createBar(120_000, 100)];
    stepEma(bars, 3);
    bars.push(createBar(180_000, 110));

    const prices: number[] = [110, 110, 90, 120];
    const expected: number[] = [105, 105, 95, 110];

    prices.forEach((price, index) => {
      bars.at(-1)!.prices.close = price;
      stepEma(bars, 3);
      expect(bars.at(-1)!.indicators?.ema?.[3]).toBe(expected[index]);
      expect(bars.at(-2)!.indicators?.ema?.[3]).toBe(100);
    });

    bars.push(createBar(240_000, 130));
    stepEma(bars, 3);
    expect(bars.at(-1)!.indicators?.ema?.[3]).toBe(120);
    expect(bars.at(-2)!.indicators?.ema?.[3]).toBe(110);
  });

  it('preserves other indicators and EMA periods', () => {
    const bars: Bar[] = [createBar(0, 100), createBar(60_000, 110), createBar(120_000, 120)];
    bars.at(-1)!.indicators = { rsi: { value: 50, avgGain: 1, avgLoss: 1 }, ema: { 5: 115 } };

    stepEma(bars, 3);

    expect(bars.at(-1)!.indicators).toEqual({ rsi: { value: 50, avgGain: 1, avgLoss: 1 }, ema: { 3: 110, 5: 115 } });
  });
});
