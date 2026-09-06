import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, LinearFunction, Slope, Timeframe, TrendLine, TrendLinePosition, TrendLineStepState } from '@shared';
import { stepRsiDivergence } from './rsi-divergence';

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

describe('stepRsiDivergence', () => {
  it('does not reprocess a retained origin trend line', () => {
    const originTrendLine: TrendLine = {
      function: new LinearFunction(0, 10, 1, 12),
      startIndex: 0,
      endIndex: 1,
      length: 1,
      slope: Slope.Ascending,
      position: TrendLinePosition.Below,
    };

    const bars: Bar[] = [createBar(0, 10), createBar(60_000, 11)];
    bars[0].chart = { trendLines: [originTrendLine] };

    bars[1].indicators = {
      rsiDivergence: {
        regular: 1,
        originTrendLines: [originTrendLine],
      },
    };

    const state: TrendLineStepState = { confirmedTrendLines: [originTrendLine] };

    expect(stepRsiDivergence(bars, state, 0.5)).toBeUndefined();
    expect(state.confirmedTrendLines?.[0]).toBe(originTrendLine);
    expect(bars[0].chart?.trendLines?.[0]).toBe(originTrendLine);
  });
});
