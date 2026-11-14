import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Bar, Direction, Exchange, MarketStructureState, MarketStructureType, PivotPointSide, Signal, Timeframe } from '@shared';
import LiveWorkerLifecycle from '../../backtesting/live/worker-lifecycle';
import MarketStructure from '../../strategies/market-structure';
import MarketStructureController from './market-structure';

afterEach(() => {
  jest.restoreAllMocks();
});

function createBar(index: number, price: number): Bar {
  return {
    symbol: 'TEST',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: index * 60_000 },
    prices: { open: price, high: price, low: price, close: price },
    volume: 0,
    backtest: { signals: [] },
  };
}

function interpolate(anchors: number[][]): number[] {
  const prices: number[] = [];

  for (let segment = 1; segment < anchors.length; segment++) {
    const [startIndex, startPrice] = anchors[segment - 1];
    const [endIndex, endPrice] = anchors[segment];

    for (let index = startIndex; index < endIndex; index++) {
      prices.push(startPrice + ((endPrice - startPrice) * (index - startIndex)) / (endIndex - startIndex));
    }
  }

  prices.push(anchors.at(-1)![1]);
  return prices;
}

describe('market structure', () => {
  it.each([
    [1, 14],
    [1, 15],
    [1, 16],
    [-1, 14],
    [-1, 15],
    [-1, 16],
  ])('requires alternating pivots before updating the streak, direction %s, repeated extreme %s', (reflection, extreme) => {
    const controller = new MarketStructureController();
    const state: MarketStructureState = {};
    const bars: Bar[] = [];
    const ranges: number[][] = [
      [10, 5],
      [15, 6],
      [12, 7],
      [14, 8],
      [11, 9],
      [extreme, 10],
      [13, 11],
      [14, 8],
      [15, 9],
      [18, 10],
      [16, 11],
      [15, 12],
    ];

    for (let index = 0; index < ranges.length; index++) {
      const [high, low] = ranges[index];
      bars.push(createBar(index, 100 + (reflection * (high + low)) / 2));
      bars[index].prices.high = 100 + (reflection === 1 ? high : -low);
      bars[index].prices.low = 100 + (reflection === 1 ? low : -high);
      expect(controller.stepMarketStructure(bars, state, 1)).toBeUndefined();
      expect(bars[index].chart?.marketStructure).toBeUndefined();

      if (index === 7) {
        expect(state.highIndex).toBe(reflection === 1 ? 1 : undefined);
        expect(state.lowIndex).toBe(reflection === 1 ? undefined : 1);
        expect(state.pivotTrend).toBeUndefined();
      }
    }

    const pivotIndexes: number[] = bars.flatMap((bar, index) => (bar.chart?.pivotPoint ? [index] : []));
    expect(pivotIndexes).toEqual([1, 7, 9]);
    expect(bars[1].chart?.pivotPoint?.side).toBe(reflection === 1 ? PivotPointSide.High : PivotPointSide.Low);
    expect(bars[7].chart?.pivotPoint?.side).toBe(reflection === 1 ? PivotPointSide.Low : PivotPointSide.High);
    expect(bars[9].chart?.pivotPoint?.marketStructure).toBe(reflection === 1 ? MarketStructureType.HH : MarketStructureType.LL);
    expect(bars[10].chart?.marketStructure).toEqual({ direction: reflection === 1 ? Direction.Up : Direction.Down, streak: 1 });
  });

  it.each([
    [1, 21],
    [-1, 21],
    [1, 20],
    [-1, 20],
  ])('does not revive a broken streak when the breaking bar becomes a pivot, direction %s, extreme %s', (reflection, extreme) => {
    const controller = new MarketStructureController();
    const state: MarketStructureState = {};
    const bars: Bar[] = [];
    const direction: Direction = reflection === 1 ? Direction.Up : Direction.Down;
    const opposite: Direction = reflection === 1 ? Direction.Down : Direction.Up;

    for (const price of [10, 14, 11, 16, 12, 18, 13, 20, 14, 19]) {
      bars.push(createBar(bars.length, 100 + reflection * price));
      controller.stepMarketStructure(bars, state, 1);
    }

    bars.push(createBar(10, 100 + reflection * 17));
    bars[10].prices.high = 100 + (reflection === 1 ? extreme : -13);
    bars[10].prices.low = 100 + (reflection === 1 ? 13 : -extreme);
    expect(controller.stepMarketStructure(bars, state, 1)).toBe(opposite);
    expect(bars[9].chart?.marketStructure).toEqual({ direction, streak: 6 });
    bars.push(createBar(11, 100 + reflection * 18));
    bars[11].prices.high = 100 + (reflection === 1 ? 18 : -12);
    bars[11].prices.low = 100 + (reflection === 1 ? 12 : -18);
    controller.stepMarketStructure(bars, state, 1);
    expect(bars[10].chart?.marketStructure).toEqual({ direction: opposite, streak: 1 });
    bars.push(createBar(12, 100 + reflection * 17));
    expect(controller.stepMarketStructure(bars, state, 1)).toBe(extreme > 20 ? direction : undefined);
    expect(state.trend).toEqual({ direction: extreme > 20 ? direction : opposite, streak: extreme > 20 ? 1 : 0 });
    bars.push(createBar(13, 100 + reflection * 17));
    controller.stepMarketStructure(bars, state, 1);
    expect(bars[12].chart?.marketStructure).toEqual({ direction: extreme > 20 ? direction : opposite, streak: 1 });
  });

  it.each([1, -1])('confirms after five closed bars and never erases confirmed pivots, direction %s', (reflection) => {
    const controller = new MarketStructureController();
    const state: MarketStructureState = {};
    const bars: Bar[] = [];
    const prices: number[] = interpolate([
      [0, 100],
      [6, 130],
      [12, 105],
      [18, 140],
      [24, 115],
      [30, 150],
      [36, 125],
      [42, 160],
      [48, 135],
      [54, 155],
      [58, 145],
      [60, 150],
      [61, 170],
      [62, 144],
      [68, 136],
      [74, 150],
    ]);
    const direction: Direction = reflection === 1 ? Direction.Up : Direction.Down;
    const opposite: Direction = reflection === 1 ? Direction.Down : Direction.Up;
    const label: MarketStructureType = reflection === 1 ? MarketStructureType.LH : MarketStructureType.HL;

    for (let index = 0; index < prices.length; index++) {
      bars.push(createBar(index, 300 + reflection * prices[index]));
      const reversal: Direction | undefined = controller.stepMarketStructure(bars, state, 5);
      expect(bars[index].chart?.marketStructure).toBeUndefined();

      if (index >= 54 && index < 60) expect(bars[54].chart?.pivotPoint).toBeUndefined();

      if (index === 60) {
        expect(reversal).toBe(opposite);
        expect(bars[59].chart?.marketStructure).toEqual({ direction, streak: 6 });
      }

      if (index >= 60) expect(bars[54].chart?.pivotPoint?.marketStructure).toBe(label);

      if (index === 67) {
        expect(bars[61].chart?.pivotPoint).toBeUndefined();
        expect(state.pivotTrend).toEqual({ direction: opposite, streak: 1 });
      }
    }
  });

  it.each([1, -1])('checks each tick without retaining its price or reversal, direction %s', (reflection) => {
    const controller = new MarketStructureController();
    const state: MarketStructureState = {};
    const bars: Bar[] = [];
    const direction: Direction = reflection === 1 ? Direction.Up : Direction.Down;
    const opposite: Direction = reflection === 1 ? Direction.Down : Direction.Up;

    for (const price of [10, 14, 11, 16, 12, 18, 13, 20, 14, 19, 15]) {
      bars.push(createBar(bars.length, 100 + reflection * price));
      controller.stepMarketStructure(bars, state, 1);
    }

    expect(bars[9].chart?.marketStructure).toEqual({ direction, streak: 6 });
    const closedState: string = JSON.stringify(state);

    for (const tick of [14, 13, 16, 13]) {
      const price: number = 100 + reflection * tick;
      bars[10].prices = { open: price, high: price, low: price, close: price };
      expect(controller.stepMarketStructure(bars, state, 1)).toBe(tick < 14 ? opposite : undefined);
      expect(JSON.stringify(state)).toBe(closedState);
      expect(bars[10].chart?.marketStructure).toBeUndefined();
    }

    bars[10].prices = {
      open: 100 + reflection * 15,
      high: 100 + (reflection === 1 ? 16 : -13),
      low: 100 + (reflection === 1 ? 13 : -16),
      close: 100 + reflection * 13,
    };
    bars.push(createBar(11, 100 + reflection * 15));
    expect(controller.stepMarketStructure(bars, state, 1)).toBeUndefined();
    expect(bars[10].chart?.marketStructure).toEqual({ direction: opposite, streak: 1 });
    bars.push(createBar(12, 100 + reflection * 16));
    expect(controller.stepMarketStructure(bars, state, 1)).toBeUndefined();
    expect(bars[11].chart?.marketStructure).toEqual({ direction: opposite, streak: 2 });
  });
});

describe('market structure strategy', () => {
  it.each([1, -1])('signals at the first confirmed opposite pivot and retains the reason, direction %s', (reflection) => {
    const strategy = new MarketStructure();
    const state: any = {};
    const bars: Bar[] = [];
    const signals: any[] = [];
    const prices: number[] = interpolate([
      [0, 100],
      [6, 130],
      [12, 105],
      [18, 140],
      [24, 115],
      [30, 150],
      [36, 125],
      [42, 160],
      [48, 135],
      [54, 155],
      [58, 145],
      [60, 150],
      [61, 170],
      [62, 144],
      [68, 136],
      [74, 150],
    ]);

    for (let index = 0; index < prices.length; index++) {
      bars.push(createBar(index, 300 + reflection * prices[index]));
      state.barDone = false;
      strategy.stepSetSignals(bars, state, { space: 5 });
      expect(state.barDone).toBe(bars[index].backtest.signals.length > 0);
      signals.push(...bars[index].backtest.signals.map((signal) => ({ index, ...signal })));
    }

    expect(signals).toEqual([{ index: 60, signal: reflection === 1 ? Signal.Sell : Signal.Buy, size: 6, price: 300 + reflection * 150 }]);
    expect(bars[54].chart?.pivotPoint?.marketStructure).toBe(reflection === 1 ? MarketStructureType.LH : MarketStructureType.HL);
  });

  it.each([1, -1])('finishes the live bar on its first price break, direction %s', async (reflection) => {
    const strategy = new MarketStructure();
    const lifecycle = new LiveWorkerLifecycle({
      strategyInstance: strategy,
      strategyConfig: { space: 1 },
      backtesterInstance: { stepCalcBacktestPerformance: () => undefined },
      timeframeMs: 60_000,
      commission: 0,
    });
    const bars: Bar[] = [10, 14, 11, 16, 12, 18, 13, 20, 14, 19].map((price, index) => createBar(index, 100 + reflection * price));
    await lifecycle.initialize(bars);
    const step = jest.spyOn(strategy, 'stepSetSignals');
    const active: Bar = await lifecycle.processTick(100 + reflection * 13);

    expect(active.backtest.signals).toEqual([
      { signal: reflection === 1 ? Signal.Sell : Signal.Buy, size: 6, price: 100 + reflection * 13 },
    ]);
    expect(step.mock.calls[0][1].barDone).toBe(true);

    for (const price of [16, 12, 15]) {
      expect(await lifecycle.processTick(100 + reflection * price)).toBe(active);
      expect(active.backtest.signals).toHaveLength(1);
      expect(active.chart?.marketStructure).toBeUndefined();
    }

    expect(step).toHaveBeenCalledTimes(1);
    jest.spyOn(Date, 'now').mockReturnValue(11 * 60_000);
    expect(lifecycle.finalizeBar()).toBe(active);
    await lifecycle.processTick(100 + reflection * 16);
    expect(active.chart?.marketStructure).toEqual({ direction: reflection === 1 ? Direction.Down : Direction.Up, streak: 1 });
  });

  it.each([1, 4, 5, 8])('uses the previous closed streak %s for qualification and size', (streak) => {
    jest.spyOn(MarketStructureController.prototype, 'stepMarketStructure').mockReturnValue(Direction.Down);
    const bars: Bar[] = [createBar(0, 100), createBar(1, 90)];
    bars[0].chart = { marketStructure: { direction: Direction.Up, streak } };
    const state: any = {};
    new MarketStructure().stepSetSignals(bars, state, { space: 5 });

    expect(bars[1].backtest.signals).toEqual(streak > 4 ? [{ signal: Signal.Sell, size: streak, price: 90 }] : []);
    expect(!!state.barDone).toBe(streak > 4);
  });

  it('does not signal without a reversal', () => {
    jest.spyOn(MarketStructureController.prototype, 'stepMarketStructure').mockReturnValue(undefined);
    const bars: Bar[] = [createBar(0, 100), createBar(1, 110)];
    bars[0].chart = { marketStructure: { direction: Direction.Up, streak: 6 } };
    const state: any = {};
    new MarketStructure().stepSetSignals(bars, state, { space: 5 });

    expect(bars[1].backtest.signals).toEqual([]);
    expect(state.barDone).toBeUndefined();
  });
});
