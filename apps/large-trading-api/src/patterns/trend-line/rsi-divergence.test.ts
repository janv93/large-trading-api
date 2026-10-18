import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, LinearFunction, Slope, Timeframe, TrendLine, TrendLinePosition, TrendLineStepState } from '@shared';
import RsiDivergenceController from './rsi-divergence';

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

function createTrendLine(startIndex: number, endIndex: number): TrendLine {
  return {
    function: new LinearFunction(startIndex, 100, endIndex, 100),
    startIndex,
    endIndex,
    length: endIndex - startIndex,
    slope: Slope.Descending,
    position: TrendLinePosition.Below,
  };
}

describe('stepRsiDivergence', () => {
  const controller = new RsiDivergenceController();

  it('keeps unsuccessful lines throughout the current bar and removes them on the next bar', () => {
    const bars: Bar[] = Array.from({ length: 6 }, (_, index) => createBar(index * 60_000, 100));
    const firstLine: TrendLine = createTrendLine(0, 5);
    const secondLine: TrendLine = createTrendLine(1, 5);
    bars[0].chart = { trendLines: [firstLine] };
    bars[1].chart = { trendLines: [secondLine] };
    const state: TrendLineStepState = { confirmedTrendLines: [firstLine, secondLine] };

    for (let tick = 0; tick < 3; tick++) {
      expect(controller.stepRsiDivergence(bars, state, 0.5)).toBeUndefined();
      expect(state.confirmedTrendLines).toEqual([firstLine, secondLine]);
      expect(bars[0].chart?.trendLines).toEqual([firstLine]);
      expect(bars[1].chart?.trendLines).toEqual([secondLine]);
    }

    bars.push(createBar(360_000, 100));
    const currentLine: TrendLine = createTrendLine(0, 6);
    state.confirmedTrendLines!.push(currentLine);
    bars[0].chart!.trendLines!.push(currentLine);

    for (let tick = 0; tick < 2; tick++) {
      expect(controller.stepRsiDivergence(bars, state, 0.5)).toBeUndefined();
      expect(state.confirmedTrendLines).toEqual([currentLine]);
      expect(bars[0].chart?.trendLines).toEqual([currentLine]);
      expect(bars[1].chart?.trendLines).toEqual([]);
    }
  });

  it('removes only unsuccessful lines when the previous bar also has a recorded divergence', () => {
    const bars: Bar[] = Array.from({ length: 6 }, (_, index) => createBar(index * 60_000, 100));
    const acceptedLine: TrendLine = createTrendLine(0, 5);
    const rejectedLine: TrendLine = createTrendLine(1, 5);
    bars[0].chart = { trendLines: [acceptedLine] };
    bars[1].chart = { trendLines: [rejectedLine] };
    bars[5].indicators = { rsiDivergence: { regular: 1, originTrendLines: [acceptedLine] } };
    const state: TrendLineStepState = { confirmedTrendLines: [acceptedLine, rejectedLine] };

    expect(controller.stepRsiDivergence(bars, state, 0.5)).toBeUndefined();
    expect(state.confirmedTrendLines).toEqual([acceptedLine, rejectedLine]);

    bars.push(createBar(360_000, 100));
    expect(controller.stepRsiDivergence(bars, state, 0.5)).toBeUndefined();
    expect(state.confirmedTrendLines).toEqual([acceptedLine]);
    expect(bars[0].chart?.trendLines).toEqual([acceptedLine]);
    expect(bars[1].chart?.trendLines).toEqual([]);
    expect(bars[5].indicators?.rsiDivergence).toEqual({ regular: 1, originTrendLines: [acceptedLine] });
  });

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

    expect(controller.stepRsiDivergence(bars, state, 0.5)).toBeUndefined();
    expect(state.confirmedTrendLines?.[0]).toBe(originTrendLine);
    expect(bars[0].chart?.trendLines?.[0]).toBe(originTrendLine);
  });
});
