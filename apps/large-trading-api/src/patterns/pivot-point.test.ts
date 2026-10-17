import { describe, expect, it } from '@jest/globals';
import {
  Bar,
  Exchange,
  MarketStructureState,
  PivotPointSide,
  Timeframe,
  TrendLine,
  TrendLinePosition,
  TrendLinesFromPivotPointsStepState,
} from '@shared';
import PivotPointController from './pivot-point';
import TrendLineController from './trend-line';

function createBar(index: number, price: number): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: index * 60_000 },
    prices: { open: price, high: price, low: price, close: price },
    volume: 0,
    backtest: { signals: [] },
  };
}

describe('pivot window boundaries', () => {
  it.each([
    { space: 1, prices: [9, 10, 9], side: PivotPointSide.High },
    { space: 1, prices: [11, 10, 11], side: PivotPointSide.Low },
    { space: 1, prices: [9, 10, 11], side: undefined },
    { space: 1, prices: [11, 10, 9], side: undefined },
    { space: 2, prices: [8, 9, 10, 9, 8], side: PivotPointSide.High },
    { space: 2, prices: [12, 11, 10, 11, 12], side: PivotPointSide.Low },
    { space: 2, prices: [12, 9, 10, 9, 8], side: undefined },
    { space: 2, prices: [8, 9, 10, 9, 12], side: undefined },
    { space: 2, prices: [8, 11, 10, 11, 12], side: undefined },
    { space: 2, prices: [12, 11, 10, 11, 8], side: undefined },
    { space: 2, prices: [10, 9, 10, 9, 10], side: PivotPointSide.High },
    { space: 2, prices: [10, 11, 10, 11, 10], side: PivotPointSide.Low },
  ])('checks all $space neighbours on each side for $prices', ({ space, prices, side }) => {
    const controller = new PivotPointController();
    const bars: Bar[] = prices.map((price, index) => createBar(index, price));
    bars.push(createBar(bars.length, 100));

    controller.stepPivotPoints(bars, space);

    expect(bars[space].chart?.pivotPoint?.side).toBe(side);
  });
});

describe.each([
  { side: PivotPointSide.High, direction: 1 },
  { side: PivotPointSide.Low, direction: -1 },
])('completed right buffer for $side pivots', ({ side, direction }) => {
  it.each([false, true])('waits for the final buffer bar to close, with crossing: %s', (crossed) => {
    const controller = new PivotPointController();
    const state: MarketStructureState = {};
    const bars: Bar[] = [];
    const reflectPrice = (price: number): number => 10 + direction * (price - 10);

    const step = (): void => {
      controller.stepPivotPoints(bars, 1);
      controller.stepMarketStructure(bars, state, 1);
    };

    for (const price of [8, 10, 9, 11, 10]) {
      bars.push(createBar(bars.length, reflectPrice(price)));
      step();
    }

    const candidateBefore = state.candidate;
    expect(candidateBefore?.index).toBe(2);
    expect(state.barsWithPivotPoints!.map((entry) => entry.index)).toEqual([1]);
    expect(bars[3].chart?.pivotPoint).toBeUndefined();
    const ticks: number[] = (crossed ? [10, 12, 10] : [10, 9, 10]).map(reflectPrice);

    for (const price of ticks) {
      bars[4].prices = { open: price, high: price, low: price, close: price };
      step();
      expect(bars[3].chart?.pivotPoint).toBeUndefined();
      expect(state.candidate).toBe(candidateBefore);
      expect(state.barsWithPivotPoints!.map((entry) => entry.index)).toEqual([1]);
    }

    bars[4].prices = { open: ticks[0], high: Math.max(...ticks), low: Math.min(...ticks), close: ticks.at(-1)! };
    bars.push(createBar(5, reflectPrice(13)));
    step();

    expect(bars[3].chart?.pivotPoint).toEqual(crossed ? undefined : { space: 1, side });
    expect(state.candidate?.index).toBe(crossed ? 2 : 3);
    expect(state.barsWithPivotPoints!.map((entry) => entry.index)).toEqual(crossed ? [1] : [1, 2]);
    const candidateAfter = state.candidate;

    for (const tick of [0, 15, 8]) {
      const price: number = reflectPrice(tick);
      bars[5].prices = { open: price, high: price, low: price, close: price };
      step();
      expect(bars[3].chart?.pivotPoint).toEqual(crossed ? undefined : { space: 1, side });
      expect(state.candidate).toBe(candidateAfter);
      expect(state.barsWithPivotPoints!.map((entry) => entry.index)).toEqual(crossed ? [1] : [1, 2]);
    }
  });

  it('connects newly confirmed pivots without waiting for another bar', () => {
    const controller = new PivotPointController();
    const trendLineController = new TrendLineController();
    const state: TrendLinesFromPivotPointsStepState = {};
    const bars: Bar[] = [];
    const reflectPrice = (price: number): number => 10 + direction * (price - 10);

    const step = (): void => {
      controller.stepPivotPoints(bars, 1);
      trendLineController.stepTrendLinesFromPivotPoints(bars, state, 1, 2, 2, false, false);
    };

    for (const price of [8, 10, 9, 11, 10]) {
      bars.push(createBar(bars.length, reflectPrice(price)));
      step();
    }

    expect(bars[3].chart?.pivotPoint).toBeUndefined();
    expect(state.confirmedTrendLines).toEqual([]);
    bars.push(createBar(5, reflectPrice(12)));
    step();

    expect(bars[3].chart?.pivotPoint?.side).toBe(side);
    expect(state.confirmedTrendLines).toHaveLength(1);
    expect(state.confirmedTrendLines![0]).toMatchObject({
      startIndex: 1,
      endIndex: 3,
      position: side === PivotPointSide.High ? TrendLinePosition.Above : TrendLinePosition.Below,
    });
    expect(bars[1].chart?.trendLines).toContain(state.confirmedTrendLines![0]);
  });

  it.each([false, true])('confirms the same lines live as in a backtest, with a buffer tick crossing: %s', (crossed) => {
    const reflectPrice = (price: number): number => 10 + direction * (price - 10);
    const bufferTicks: number[] = (crossed ? [9, 10.5, 9] : [9, 9.5, 9]).map(reflectPrice);
    const position: TrendLinePosition = side === PivotPointSide.High ? TrendLinePosition.Above : TrendLinePosition.Below;

    const run = (live: boolean): TrendLine[] => {
      const controller = new PivotPointController();
      const trendLineController = new TrendLineController();
      const state: TrendLinesFromPivotPointsStepState = {};
      const bars: Bar[] = [];

      const step = (): void => {
        controller.stepPivotPoints(bars, 1);
        trendLineController.stepTrendLinesFromPivotPoints(bars, state, 1, 8, 8, false, true);
      };

      for (const price of [9, 9, 10, 9, 9, 9, 9, 9, 9, 9, 10, 9]) {
        bars.push(createBar(bars.length, reflectPrice(price)));
        step();
      }

      bars.push(createBar(bars.length, bufferTicks[0]));

      if (live) {
        for (const price of bufferTicks) {
          bars[12].prices = { open: price, high: price, low: price, close: price };
          step();
        }
      }

      bars[12].prices = { open: bufferTicks[0], high: Math.max(...bufferTicks), low: Math.min(...bufferTicks), close: bufferTicks.at(-1)! };
      if (!live) step();
      bars.push(createBar(bars.length, reflectPrice(9)));
      step();

      return state.confirmedTrendLines!.filter((line) => line.startIndex === 2 && line.endIndex === 10 && line.position === position);
    };

    expect(run(false)).toHaveLength(crossed ? 0 : 1);
    expect(run(true)).toHaveLength(crossed ? 0 : 1);
  });
});
