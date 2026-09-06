import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  Bar,
  Exchange,
  LinearFunction,
  Signal,
  Slope,
  Timeframe,
  TrendLine,
  TrendLinePosition
} from '@shared';
import TrendLineController from '../patterns/trend-line';
import TrendLineBreakthrough from './trend-line';

function createBar(openTime: number, price: number): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: openTime },
    prices: { open: price, high: price, low: price, close: price },
    volume: 0,
    backtest: { signals: [] }
  };
}

describe('trend-line breakthrough strategy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a plain signal only for a newly returned breakthrough', () => {
    const bars: Bar[] = [createBar(0, 10), createBar(60_000, 11)];

    const trendLine: TrendLine = {
      function: new LinearFunction(0, 10),
      startIndex: 0,
      endIndex: 0,
      breakThroughIndex: 1,
      length: 2,
      slope: Slope.Ascending,
      position: TrendLinePosition.Above
    };

    bars[1].chart = { trendLineBreakthroughs: [trendLine] };
    jest.spyOn(TrendLineController.prototype, 'stepTrendLines').mockImplementation(() => undefined);
    jest.spyOn(TrendLineController.prototype, 'stepTrendLineBreakthroughs')
      .mockReturnValueOnce([trendLine])
      .mockReturnValueOnce([]);
    const strategy = new TrendLineBreakthrough();
    const state = {};

    strategy.stepSetSignals(bars, state, { percentOfProfit: 0.5 });
    strategy.stepSetSignals(bars, state, { percentOfProfit: 0.5 });

    expect(bars[1].backtest.signals).toHaveLength(1);

    expect(bars[1].backtest.signals[0]).toEqual(expect.objectContaining({
      signal: Signal.Buy
    }));

    expect(bars[1].backtest.signals[0]).not.toHaveProperty('uniqueIdentifier');
  });
});