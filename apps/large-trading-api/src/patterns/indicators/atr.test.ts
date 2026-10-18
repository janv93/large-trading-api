import { describe, expect, it } from '@jest/globals';
import { Bar, BarPrices, Exchange, Timeframe } from '@shared';
import { stepAtr } from './atr';

function createBar(openTime: number, prices: BarPrices): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: openTime },
    prices,
    volume: 100,
    backtest: { signals: [] },
  };
}

function createTickPrices(price: number): BarPrices {
  return { open: price, high: price, low: price, close: price };
}

const historicalPrices: BarPrices[] = [
  { open: 10, high: 11, low: 9, close: 10 },
  { open: 10, high: 12, low: 10, close: 11 },
  { open: 11, high: 11, low: 8, close: 9 },
  { open: 9, high: 13, low: 9, close: 12 },
];

describe('stepAtr', () => {
  it('calculates ATR only for closed bars', () => {
    const bars: Bar[] = [];
    const expectedClosedAtr: (number | undefined)[] = [undefined, undefined, undefined, 2.5, 3.25];

    [...historicalPrices, createTickPrices(12)].forEach((prices, index) => {
      bars.push(createBar(index * 60_000, prices));
      stepAtr(bars, 2);
      expect(bars.at(-2)?.indicators?.atr).toBe(expectedClosedAtr[index]);
      expect(bars.at(-1)!.indicators?.atr).toBeUndefined();
    });

    expect(bars[2].indicators?.atr).toBe(2.5);
  });

  it('ignores ongoing ticks and uses the full range once the bar has closed', () => {
    const bars: Bar[] = historicalPrices.slice(0, 3).map((prices, index) => createBar(index * 60_000, prices));
    bars.push(createBar(180_000, createTickPrices(12)));

    for (const price of [12, 9, 13]) {
      bars.at(-1)!.prices = createTickPrices(price);
      stepAtr(bars, 2);
      expect(bars.at(-2)!.indicators?.atr).toBe(2.5);
      expect(bars.at(-1)!.indicators?.atr).toBeUndefined();
    }

    bars.at(-1)!.prices = historicalPrices[3];
    bars.push(createBar(240_000, createTickPrices(10)));
    stepAtr(bars, 2);
    expect(bars.at(-2)!.indicators?.atr).toBe(3.25);
    expect(bars.at(-1)!.indicators?.atr).toBeUndefined();
  });

  it('preserves other indicators of the closed bar', () => {
    const bars: Bar[] = historicalPrices.map((prices, index) => createBar(index * 60_000, prices));
    bars[2].indicators = { ema: { 3: 100 } };

    stepAtr(bars, 2);

    expect(bars[2].indicators).toEqual({ ema: { 3: 100 }, atr: 2.5 });
  });
});
