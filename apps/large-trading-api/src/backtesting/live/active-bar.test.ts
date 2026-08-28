import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, Signal, Slope, Timeframe, TrendLinePosition } from '@shared';
import { LinearFunction } from '@shared';
import { createActiveBar, deduplicateActiveBar, finalizeActiveBar } from './active-bar';

const committed: Bar = {
  symbol: 'BTCUSDT',
  exchange: Exchange.Binance,
  timeframe: Timeframe._1Minute,
  times: { open: 1_000 },
  prices: { open: 10, high: 12, low: 9, close: 11 },
  volume: 100,
  backtest: { signals: [] }
};

describe('active live bar', () => {
  it('rebuilds one timeframe while preserving cumulative discoveries', () => {
    const previous: Bar = {
      ...committed,
      times: { open: 61_000 },
      candlestickPatterns: { hammer: true },
      indicators: { rsi: 40, rsiDivergence: { regular: 1, originTrendLines: [] } },
      chart: { marketStructure: {} as any, trendLineBreakthroughs: [] },
      backtest: { signals: [{ uniqueIdentifier: 'buy', signal: Signal.Buy, size: 1, price: 12 }] }
    };

    const active: Bar = createActiveBar(committed, 13, 60_000, previous);

    expect(active.times.open).toBe(61_000);
    expect(active.prices).toEqual({ open: 13, high: 13, low: 13, close: 13 });
    expect(active.candlestickPatterns).toEqual(previous.candlestickPatterns);
    expect(active.indicators).toEqual({ rsiDivergence: previous.indicators!.rsiDivergence });
    expect(active.chart).toEqual({ trendLineBreakthroughs: [] });
    expect(active.backtest.signals).toEqual(previous.backtest.signals);
  });

  it('deduplicates identified and legacy signals without using their changing price', () => {
    const active: Bar = createActiveBar(committed, 13, 60_000);
    active.backtest.signals = [
      { uniqueIdentifier: 'buy', signal: Signal.Buy, size: 1, price: 12 },
      { uniqueIdentifier: 'buy', signal: Signal.Buy, size: 1, price: 13 },
      { signal: Signal.Sell, size: 1, price: 12 },
      { signal: Signal.Sell, size: 1, price: 13 }
    ];
    const breakthrough = {
      function: new LinearFunction(0, 10, 10, 20),
      startIndex: 0,
      endIndex: 10,
      breakThroughIndex: 12,
      length: 10,
      slope: Slope.Ascending,
      position: TrendLinePosition.Above
    };
    active.chart = { trendLineBreakthroughs: [breakthrough, { ...breakthrough }] };

    deduplicateActiveBar(active);

    expect(active.backtest.signals).toHaveLength(2);
    expect(active.backtest.signals.map(signal => signal.price)).toEqual([12, 12]);
    expect(active.chart.trendLineBreakthroughs).toHaveLength(1);
  });

  it('uses authoritative exchange values when finalizing', () => {
    const active: Bar = createActiveBar(committed, 13, 60_000);
    active.candlestickPatterns = { hammer: true };
    const historical: Bar = {
      ...active,
      times: { open: 61_000, close: 120_999 },
      prices: { open: 11, high: 14, low: 10, close: 12 },
      volume: 250,
      numberOfTrades: 42,
      backtest: { signals: [] }
    };

    const finalized: Bar = finalizeActiveBar(active, historical);

    expect(finalized.times).toEqual(historical.times);
    expect(finalized.prices).toEqual(historical.prices);
    expect(finalized.volume).toBe(250);
    expect(finalized.numberOfTrades).toBe(42);
    expect(finalized.candlestickPatterns).toEqual({ hammer: true });
  });
});