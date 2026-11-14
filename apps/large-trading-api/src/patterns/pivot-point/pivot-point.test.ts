import { describe, expect, it } from '@jest/globals';
import {
  Bar,
  Direction,
  Exchange,
  MarketStructureState,
  MarketStructureSwing,
  MarketStructureType,
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
  return state.swings?.map((swing: MarketStructureSwing) => swing.index) ?? [];
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

    const candidateBefore = state.candidateSwing;
    expect(candidateBefore?.index).toBe(2);
    expect(getSwingIndexes(state)).toEqual([1]);
    expect(bars[3].chart?.pivotPoint).toBeUndefined();
    const ticks: number[] = (crossed ? [10, 12, 10] : [10, 9, 10]).map(reflectPrice);

    for (const price of ticks) {
      bars[4].prices = { open: price, high: price, low: price, close: price };
      step();
      expect(bars[3].chart?.pivotPoint).toBeUndefined();
      expect(state.candidateSwing).toBe(candidateBefore);
      expect(getSwingIndexes(state)).toEqual([1]);
    }

    bars[4].prices = { open: ticks[0], high: Math.max(...ticks), low: Math.min(...ticks), close: ticks.at(-1)! };
    bars.push(createBar(5, reflectPrice(13)));
    step();

    expect(bars[3].chart?.pivotPoint).toEqual(crossed ? undefined : { space: 1, side });
    expect(state.candidateSwing?.index).toBe(crossed ? 2 : 3);
    expect(getSwingIndexes(state)).toEqual(crossed ? [1] : [1, 2]);
    const candidateAfter = state.candidateSwing;

    for (const tick of [0, 15, 8]) {
      const price: number = reflectPrice(tick);
      bars[5].prices = { open: price, high: price, low: price, close: price };
      step();
      expect(bars[3].chart?.pivotPoint).toEqual(crossed ? undefined : { space: 1, side });
      expect(state.candidateSwing).toBe(candidateAfter);
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

describe('market structure', () => {
  describe.each([1, -1])('with price direction %s', (priceDirection) => {
    const trendDirection: Direction = priceDirection === 1 ? Direction.Up : Direction.Down;
    const reversalDirection: Direction = priceDirection === 1 ? Direction.Down : Direction.Up;
    const toPrice = (price: number): number => 30 + priceDirection * price;
    const trendPrices: number[] = [10, 12, 10, 13, 11, 14, 12, 15, 13, 14];

    const setTicks = (bar: Bar, ticks: number[]): void => {
      const prices: number[] = ticks.map(toPrice);
      bar.prices = { open: prices[0], high: Math.max(...prices), low: Math.min(...prices), close: prices.at(-1)! };
    };

    const run = (prices: number[]) => {
      const controller = new MarketStructureController();
      const state: MarketStructureState = {};
      const bars: Bar[] = [];
      const reversals: (Direction | undefined)[] = [];

      const step = (): void => {
        reversals.push(controller.stepMarketStructure(bars, state, 1));
      };

      for (const price of prices) {
        bars.push(createBar(bars.length, toPrice(price)));
        step();
      }

      return { bars, reversals, step };
    };

    it('labels swings and draws the streak on closed bars only', () => {
      const { bars, reversals } = run(trendPrices);
      const labels: MarketStructureType[] =
        priceDirection === 1
          ? [MarketStructureType.HH, MarketStructureType.HL, MarketStructureType.HH, MarketStructureType.HL]
          : [MarketStructureType.LL, MarketStructureType.LH, MarketStructureType.LL, MarketStructureType.LH];

      expect(bars.slice(3, 7).map((bar) => bar.chart?.pivotPoint?.marketStructure)).toEqual(labels);
      expect(bars.map((bar) => bar.chart?.marketStructure?.streak)).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        2,
        3,
        4,
        undefined,
      ]);
      expect(bars[8].chart?.marketStructure?.direction).toBe(trendDirection);
      expect(reversals.every((reversal) => reversal === undefined)).toBe(true);
    });

    it('reports a break only on the tick that crosses the last swing against the trend', () => {
      const { bars, reversals, step } = run(trendPrices);
      const ticks: number[] = [13, 11.5, 13];
      bars.push(createBar(bars.length, toPrice(ticks[0])));
      step();

      for (const tick of ticks.slice(1)) {
        setTicks(bars[10], [tick]);
        step();
      }

      expect(reversals.slice(-3)).toEqual([undefined, reversalDirection, undefined]);
      setTicks(bars[10], ticks);
      bars.push(createBar(bars.length, toPrice(13)));
      step();

      expect(reversals.at(-1)).toBeUndefined();
      expect(bars[10].chart?.marketStructure).toEqual({ streak: 1, direction: reversalDirection });
    });

    it('reports the same break when a backtest steps the completed bar', () => {
      const { bars, reversals, step } = run(trendPrices);
      bars.push(createBar(bars.length, toPrice(13)));
      setTicks(bars[10], [13, 11.5, 13]);
      step();

      expect(reversals.at(-1)).toBe(reversalDirection);
    });

    it('flips the trend on a confirmed swing against it without reporting a reversal', () => {
      const { bars, reversals } = run([10, 12, 10, 13, 11, 14, 12, 13.5, 12.5, 13, 12.8]);

      expect(bars[7].chart?.pivotPoint?.marketStructure).toBe(priceDirection === 1 ? MarketStructureType.LH : MarketStructureType.HL);
      expect(bars[9].chart?.marketStructure).toEqual({ streak: 1, direction: reversalDirection });
      expect(reversals.every((reversal) => reversal === undefined)).toBe(true);
    });
  });

  it.each([1, 2, 3])('reports the same reversals live as in a backtest with space %s', (space) => {
    let seed: number = space;

    const random = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };

    const tickPaths: number[][] = [];
    let price: number = 100;

    for (let index = 0; index < 600; index++) {
      const ticks: number[] = [];

      for (let tick = 0; tick < 4; tick++) {
        price = Math.round((price + (random() - 0.5) * 4) * 2) / 2;
        ticks.push(price);
      }

      tickPaths.push(ticks);
    }

    const setTicks = (bar: Bar, ticks: number[]): void => {
      bar.prices = { open: ticks[0], high: Math.max(...ticks), low: Math.min(...ticks), close: ticks.at(-1)! };
    };

    const replay = (live: boolean) => {
      const controller = new MarketStructureController();
      const state: MarketStructureState = {};
      const bars: Bar[] = [];
      const reversals: string[] = [];

      for (const ticks of tickPaths) {
        bars.push(createBar(bars.length, ticks[0]));
        const steppedTicks: number[] = live ? ticks : [];

        for (const tick of steppedTicks) {
          setTicks(bars.at(-1)!, [tick]);
          const reversal: Direction | undefined = controller.stepMarketStructure(bars, state, space);

          if (reversal) {
            reversals.push(`${bars.length - 1}:${reversal}`);
            break;
          }
        }

        setTicks(bars.at(-1)!, ticks);

        if (!live) {
          const reversal: Direction | undefined = controller.stepMarketStructure(bars, state, space);
          if (reversal) reversals.push(`${bars.length - 1}:${reversal}`);
        }
      }

      return { reversals, charts: JSON.stringify(bars.map((bar) => bar.chart)) };
    };

    const backtest = replay(false);
    const live = replay(true);

    expect(backtest.reversals.length).toBeGreaterThan(10);
    expect(live.reversals).toEqual(backtest.reversals);
    expect(live.charts).toEqual(backtest.charts);
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

    expect(state.swings).toBeUndefined();
    expect(state.candidateSwing?.index).toBe(expectedIndex);
    expect(bars[expectedIndex].chart?.pivotPoint).toBeUndefined();

    for (const price of [10, 11]) {
      bars.push(createBar(bars.length, price));
      controller.stepMarketStructure(bars, state, 2);
    }

    expect(getSwingIndexes(state)).toEqual([expectedIndex]);
    expect(bars[expectedIndex].chart?.pivotPoint).toEqual({ side: PivotPointSide.High, space: 2 });
  });
});
