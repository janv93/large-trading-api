import { describe, expect, it } from '@jest/globals';
import {
  Bar,
  Direction,
  Exchange,
  MarketStructureState,
  MarketStructureSwing,
  PivotPointSide,
  Timeframe,
  TrendLine,
  TrendLinePosition,
  TrendLinesFromPivotPointsStepState,
} from '@shared';
import PivotTrendLineController from '../trend-line/pivot-trend-line';
import MarketStructureController from './market-structure';
import PivotPointController from './pivot-point';

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

function getSwingIndexes(state: MarketStructureState): number[] {
  const swings: MarketStructureSwing[] = state.swings?.slice(0, -1) ?? [];
  return swings.map((swing) => swing.index);
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
    const controller = new MarketStructureController();
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

    const candidateBefore = state.swings?.at(-1);
    expect(candidateBefore?.index).toBe(2);
    expect(getSwingIndexes(state)).toEqual([1]);
    expect(bars[3].chart?.pivotPoint).toBeUndefined();
    const ticks: number[] = (crossed ? [10, 12, 10] : [10, 9, 10]).map(reflectPrice);

    for (const price of ticks) {
      bars[4].prices = { open: price, high: price, low: price, close: price };
      step();
      expect(bars[3].chart?.pivotPoint).toBeUndefined();
      expect(state.swings?.at(-1)).toBe(candidateBefore);
      expect(getSwingIndexes(state)).toEqual([1]);
    }

    bars[4].prices = { open: ticks[0], high: Math.max(...ticks), low: Math.min(...ticks), close: ticks.at(-1)! };
    bars.push(createBar(5, reflectPrice(13)));
    step();

    expect(bars[3].chart?.pivotPoint).toEqual(crossed ? undefined : { space: 1, side });
    expect(state.swings?.at(-1)?.index).toBe(crossed ? 2 : 3);
    expect(getSwingIndexes(state)).toEqual(crossed ? [1] : [1, 2]);
    const candidateAfter = state.swings?.at(-1);

    for (const tick of [0, 15, 8]) {
      const price: number = reflectPrice(tick);
      bars[5].prices = { open: price, high: price, low: price, close: price };
      step();
      expect(bars[3].chart?.pivotPoint).toEqual(crossed ? undefined : { space: 1, side });
      expect(state.swings?.at(-1)).toBe(candidateAfter);
      expect(getSwingIndexes(state)).toEqual(crossed ? [1] : [1, 2]);
    }
  });

  it('connects newly confirmed pivots without waiting for another bar', () => {
    const controller = new PivotPointController();
    const trendLineController = new PivotTrendLineController();
    const state: TrendLinesFromPivotPointsStepState = {};
    const bars: Bar[] = [];
    const reflectPrice = (price: number): number => 10 + direction * (price - 10);

    const step = (): void => {
      controller.stepPivotPoints(bars, 1);
      trendLineController.stepTrendLines(bars, state, 1, 2, 2, false, false);
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
      const trendLineController = new PivotTrendLineController();
      const state: TrendLinesFromPivotPointsStepState = {};
      const bars: Bar[] = [];

      const step = (): void => {
        controller.stepPivotPoints(bars, 1);
        trendLineController.stepTrendLines(bars, state, 1, 8, 8, false, true);
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

  it('does not recreate a line that a tick of the ongoing bar broke', () => {
    const reflectPrice = (price: number): number => 10 + direction * (price - 10);
    const ticks: number[] = [10.5, 9, 9].map(reflectPrice);
    const isLine = (line: TrendLine): boolean => line.startIndex === 2 && line.endIndex === 10;

    const run = (live: boolean): number[] => {
      const controller = new PivotPointController();
      const trendLineController = new PivotTrendLineController();
      const state: TrendLinesFromPivotPointsStepState = {};
      const bars: Bar[] = [];
      let breakthroughCount: number = 0;

      const step = (): void => {
        controller.stepPivotPoints(bars, 1);
        trendLineController.stepTrendLines(bars, state, 1, 8, 8, false, false);
        breakthroughCount += trendLineController.stepTrendLineBreakthroughs(bars, state, false).filter(isLine).length;
      };

      for (const price of [9, 9, 10, 9, 9, 9, 9, 9, 9, 9, 10, 9]) {
        bars.push(createBar(bars.length, reflectPrice(price)));
        step();
      }

      bars.push(createBar(bars.length, ticks[0]));

      if (live) {
        for (const price of ticks) {
          bars[12].prices = { open: price, high: price, low: price, close: price };
          step();
        }
      }

      bars[12].prices = { open: ticks[0], high: Math.max(...ticks), low: Math.min(...ticks), close: ticks.at(-1)! };
      if (!live) step();

      for (const price of [9, 11]) {
        bars.push(createBar(bars.length, reflectPrice(price)));
        step();
      }

      return [bars[2].chart!.trendLines!.filter(isLine).length, state.confirmedTrendLines!.filter(isLine).length, breakthroughCount];
    };

    expect(run(false)).toEqual([1, 0, 1]);
    expect(run(true)).toEqual([1, 0, 1]);
  });
});

describe('market structure reversal', () => {
  describe.each([1, -1])('with price direction %s', (priceDirection) => {
    it('does not use an unlabeled initial swing as a reversal level', () => {
      const controller = new MarketStructureController();
      const state: MarketStructureState = {};
      const bars: Bar[] = [];

      for (const price of [10, 12, 10, 13, 9, 12, 14]) {
        bars.push(createBar(bars.length, 30 + priceDirection * price));
        controller.stepMarketStructure(bars, state, 1);
      }

      const direction: Direction = priceDirection === 1 ? Direction.Up : Direction.Down;
      expect(bars.at(-1)!.chart?.marketStructure).toEqual({ streak: 1, direction });
      expect(state.reversalLevel).toBeUndefined();
      const price: number = 30 + priceDirection * 8;
      bars.at(-1)!.prices = { open: price, high: price, low: price, close: price };
      controller.stepMarketStructure(bars, state, 1);

      expect(bars.at(-1)!.chart?.marketStructure).toEqual({ streak: 1, direction });
      expect(state.reversalLevel).toBeUndefined();
    });

    it.each([
      { name: 'a break in the initial right buffer', prices: [10, 12, 10, 13, 11, 14, 9, 12, 13], reversed: true },
      { name: 'a break after the initial right buffer', prices: [10, 12, 10, 13, 11, 14, 13, 10, 12, 13], reversed: true },
      { name: 'a touch without a break', prices: [10, 12, 10, 13, 11, 14, 13, 11, 12, 13], reversed: false },
    ])('preserves $name when confirming the next swing', ({ prices, reversed }) => {
      const controller = new MarketStructureController();
      const state: MarketStructureState = {};
      const bars: Bar[] = [];

      for (const price of prices) {
        bars.push(createBar(bars.length, 20 + priceDirection * price));
        controller.stepMarketStructure(bars, state, 1);
      }

      const trendDirection: Direction = priceDirection === 1 ? Direction.Up : Direction.Down;
      const reversalDirection: Direction = priceDirection === 1 ? Direction.Down : Direction.Up;
      expect(state.swings?.at(-2)?.trend).toEqual({ streak: 3, direction: trendDirection });
      expect(bars.at(-1)!.chart?.marketStructure).toEqual({
        streak: reversed ? 1 : 3,
        direction: reversed ? reversalDirection : trendDirection,
      });
    });

    it('reverses a reversal before the swing that caused it is confirmed', () => {
      const controller = new MarketStructureController();
      const state: MarketStructureState = {};
      const bars: Bar[] = [];

      for (const price of [10, 12, 10, 13, 11, 14, 12, 10, 8, 15, 16]) {
        bars.push(createBar(bars.length, 20 + priceDirection * price));
        controller.stepMarketStructure(bars, state, 1);
      }

      const trendDirection: Direction = priceDirection === 1 ? Direction.Up : Direction.Down;
      const reversalDirection: Direction = priceDirection === 1 ? Direction.Down : Direction.Up;
      expect(bars.slice(7).map((bar) => bar.chart?.marketStructure)).toEqual([
        { streak: 1, direction: reversalDirection },
        { streak: 1, direction: reversalDirection },
        { streak: 1, direction: trendDirection },
        { streak: 1, direction: trendDirection },
      ]);
    });

    it('reverses when the pullback before a new high is broken', () => {
      const controller = new MarketStructureController();
      const state: MarketStructureState = {};
      const bars: Bar[] = [];

      for (const price of [10, 12, 10, 13, 11, 14, 12, 15, 11.5]) {
        bars.push(createBar(bars.length, 20 + priceDirection * price));
        controller.stepMarketStructure(bars, state, 1);
      }

      const trendDirection: Direction = priceDirection === 1 ? Direction.Up : Direction.Down;
      const reversalDirection: Direction = priceDirection === 1 ? Direction.Down : Direction.Up;
      expect(bars.slice(7).map((bar) => bar.chart?.marketStructure)).toEqual([
        { streak: 2, direction: trendDirection },
        { streak: 1, direction: reversalDirection },
      ]);
    });

    it('prioritizes reversal when a full bar breaks both boundaries', () => {
      const controller = new MarketStructureController();
      const state: MarketStructureState = {};
      const bars: Bar[] = [];

      for (const price of [10, 12, 10, 13, 11, 14, 12, 12]) {
        bars.push(createBar(bars.length, 30 + priceDirection * price));
        controller.stepMarketStructure(bars, state, 1);
      }

      bars[7].prices = {
        open: 30 + priceDirection * 12,
        high: 30 + (priceDirection === 1 ? 15 : -10),
        low: 30 + (priceDirection === 1 ? 10 : -15),
        close: 30 + priceDirection * 12,
      };
      controller.stepMarketStructure(bars, state, 1);

      expect(bars[7].chart?.marketStructure).toEqual({ streak: 1, direction: priceDirection === 1 ? Direction.Down : Direction.Up });
      expect(state.reversalLevel?.price).toBe(30 + priceDirection * 15);
      expect(state.reversalLevel?.index).toBe(7);
    });

    it.each([
      { ticks: [10, 15], direction: 1, reversalPrice: 10, reversalIndex: 7 },
      { ticks: [15, 10], direction: -1, reversalPrice: 15, reversalIndex: 7 },
      { ticks: [15, 10, 13], direction: -1, reversalPrice: 15, reversalIndex: 7 },
      { ticks: [10, 13], direction: -1, reversalPrice: 14, reversalIndex: 5 },
    ])('preserves the order of live ticks $ticks', ({ ticks, direction, reversalPrice, reversalIndex }) => {
      const controller = new MarketStructureController();
      const state: MarketStructureState = {};
      const bars: Bar[] = [];

      for (const price of [10, 12, 10, 13, 11, 14, 12, 12]) {
        bars.push(createBar(bars.length, 30 + priceDirection * price));
        controller.stepMarketStructure(bars, state, 1);
      }

      for (const tick of ticks) {
        const price: number = 30 + priceDirection * tick;
        bars[7].prices = { open: price, high: price, low: price, close: price };
        controller.stepMarketStructure(bars, state, 1);
      }

      expect(bars[7].chart?.marketStructure).toEqual({
        streak: 1,
        direction: priceDirection * direction === 1 ? Direction.Up : Direction.Down,
      });
      expect(state.swings?.at(-2)?.trend?.streak).toBe(2);
      expect(state.reversalLevel?.price).toBe(30 + priceDirection * reversalPrice);
      expect(state.reversalLevel?.index).toBe(reversalIndex);
    });
  });

  it('keeps a reversal seen on an earlier tick when a later tick recovers', () => {
    const controller = new MarketStructureController();
    const state: MarketStructureState = {};
    const bars: Bar[] = [];

    for (const price of [10, 12, 10, 13, 11, 14, 12, 12]) {
      bars.push(createBar(bars.length, price));
      controller.stepMarketStructure(bars, state, 1);
    }

    expect(bars[7].chart?.marketStructure).toEqual({ streak: 2, direction: Direction.Up });

    for (const price of [10, 13]) {
      bars[7].prices = { open: price, high: price, low: price, close: price };
      controller.stepMarketStructure(bars, state, 1);
      expect(bars[7].chart?.marketStructure).toEqual({ streak: 1, direction: Direction.Down });
    }
  });
});

describe('market structure swing selection', () => {
  it.each([
    { nextHigh: 11, expectedIndex: 2 },
    { nextHigh: 12, expectedIndex: 2 },
    { nextHigh: 13, expectedIndex: 5 },
  ])('retains the first extreme unless the next high at $nextHigh is higher', ({ nextHigh, expectedIndex }) => {
    const controller = new MarketStructureController();
    const state: MarketStructureState = {};
    const bars: Bar[] = [];

    for (const price of [9, 7, 12, 10, 11, nextHigh, 9, 8, 9]) {
      bars.push(createBar(bars.length, price));
      controller.stepMarketStructure(bars, state, 2);
    }

    expect(state.swings).toHaveLength(1);
    expect(state.swings?.at(-1)?.index).toBe(expectedIndex);
    expect(bars[expectedIndex].chart?.pivotPoint).toBeUndefined();

    for (const price of [10, 11]) {
      bars.push(createBar(bars.length, price));
      controller.stepMarketStructure(bars, state, 2);
    }

    expect(getSwingIndexes(state)).toEqual([expectedIndex]);
    expect(bars[expectedIndex].chart?.pivotPoint).toEqual({ side: PivotPointSide.High, space: 2 });
  });
});
