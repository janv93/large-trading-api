import { describe, expect, it } from '@jest/globals';
import {
  Bar,
  Exchange,
  LinearFunction,
  PivotPointSide,
  Slope,
  Timeframe,
  TrendLine,
  TrendLinePosition,
  TrendLinesFromPivotPointsStepState,
  TrendLineStepState
} from '@shared';
import TrendLineController from './trend-line';

interface TrendLineOptions {
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
  length: number;
  position: TrendLinePosition;
}

function createBar(index: number, low = 10, high = 10): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: index * 60_000 },
    prices: { open: low, low, high, close: high },
    volume: 0,
    backtest: { signals: [] }
  };
}

function createBars(count: number): Bar[] {
  return Array.from({ length: count }, (_, index) => createBar(index));
}

function setPivotPoint(bar: Bar, side: PivotPointSide): void {
  bar.chart = { ...bar.chart, pivotPoint: { space: 0, side } };
}

function createTrendLine(options: Partial<TrendLineOptions> = {}): TrendLine {
  const startIndex: number = options.startIndex ?? 0;
  const endIndex: number = options.endIndex ?? 1;
  const startPrice: number = options.startPrice ?? 10;
  const endPrice: number = options.endPrice ?? 10;
  const linearFunction = new LinearFunction(startIndex, startPrice, endIndex, endPrice);

  return {
    function: linearFunction,
    startIndex,
    endIndex,
    length: options.length ?? endIndex - startIndex,
    slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
    position: options.position ?? TrendLinePosition.Above
  };
}

function cloneTrendLine(trendLine: TrendLine): TrendLine {
  return {
    ...trendLine,
    function: new LinearFunction(trendLine.function.m, trendLine.function.b)
  };
}

describe('TrendLineController', () => {
  it('updates one candidate per bar across new bars and repeated ticks', () => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [createBar(0)];

    controller.stepTrendLines(bars, state, 100, 2, false, false);
    bars.push(createBar(1, 9, 11));
    controller.stepTrendLines(bars, state, 100, 2, false, false);

    bars[1].prices.low = 8;
    bars[1].prices.high = 12;
    controller.stepTrendLines(bars, state, 100, 2, false, false);

    expect(state.candidateTrendLines).toHaveLength(2);
    expect(state.candidateTrendLines![1]).toEqual({ startIndex: 1, minSlopeBelow: Infinity, maxSlopeAbove: -Infinity });
    expect(state.candidateTrendLines![0]).toEqual({ startIndex: 0, minSlopeBelow: -2, maxSlopeAbove: 2 });

    bars.push(createBar(2), createBar(3));
    controller.stepTrendLines(bars.slice(0, 3), state, 100, 2, false, false);
    controller.stepTrendLines(bars, state, 100, 2, false, false);

    expect(state.candidateTrendLines!.map(entry => entry.startIndex)).toEqual([1, 2, 3]);
  });

  it('confirms each side once per active bar and permits new endpoints on later bars', () => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [createBar(0)];

    controller.stepTrendLines(bars, state, 1, 10, false, false);
    bars.push(createBar(1, 9, 11));
    controller.stepTrendLines(bars, state, 1, 10, false, false);
    controller.stepTrendLines(bars, state, 1, 10, false, false);

    expect(state.confirmedTrendLines).toHaveLength(2);
    expect(bars[0].chart!.trendLines).toHaveLength(2);

    bars.push(createBar(2, 8, 12));
    controller.stepTrendLines(bars, state, 2, 10, false, false);

    expect(state.confirmedTrendLines).toHaveLength(4);
    expect(state.confirmedTrendLines!.map(line => line.endIndex)).toEqual([1, 1, 2, 2]);
    expect(bars[0].chart!.trendLines).toHaveLength(4);
  });

  it('retains pending lines within a bar and promotes them once on a later bar', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(6);
    const state: TrendLineStepState = {
      candidateTrendLines: [{ startIndex: 0, minSlopeBelow: Infinity, maxSlopeAbove: -Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[5] = createBar(5, 5, 15);

    controller.stepTrendLines(bars, state, 5, 100, false, true);
    controller.stepTrendLines(bars, state, 5, 100, false, true);

    expect(state.pendingTrendLines).toHaveLength(2);
    expect(state.confirmedTrendLines).toHaveLength(0);

    bars.push(createBar(6, 5, 15));
    controller.stepTrendLines(bars, state, 100, 100, false, true);
    controller.stepTrendLines(bars, state, 100, 100, false, true);

    expect(state.pendingTrendLines).toHaveLength(0);
    expect(state.confirmedTrendLines).toHaveLength(2);
    expect(bars[0].chart!.trendLines).toHaveLength(2);
  });

  it('permanently removes a pending line crossed by a later tick of the same bar', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(6);
    const pendingLine: TrendLine = createTrendLine({ endIndex: 5, endPrice: 15, length: 5 });
    const state: TrendLineStepState = {
      candidateTrendLines: [],
      pendingTrendLines: [pendingLine],
      confirmedTrendLines: []
    };
    bars[5].prices.high = 15;

    controller.stepTrendLines(bars, state, 100, 100, false, true);
    expect(state.pendingTrendLines).toHaveLength(1);

    bars[5].prices.high = 16;
    controller.stepTrendLines(bars, state, 100, 100, false, true);
    controller.stepTrendLines(bars, state, 100, 100, false, true);

    expect(state.pendingTrendLines).toHaveLength(0);
    expect(state.confirmedTrendLines).toHaveLength(0);
  });

  it('removes a mature pending line without duplicating an existing confirmation', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(7);
    const confirmedLine: TrendLine = createTrendLine({ endIndex: 5, endPrice: 15, length: 5 });
    const state: TrendLineStepState = {
      candidateTrendLines: [],
      pendingTrendLines: [cloneTrendLine(confirmedLine)],
      confirmedTrendLines: [confirmedLine]
    };
    bars[0].chart = { trendLines: [confirmedLine] };

    controller.stepTrendLines(bars, state, 100, 100, false, true);

    expect(state.pendingTrendLines).toHaveLength(0);
    expect(state.confirmedTrendLines).toHaveLength(1);
    expect(bars[0].chart.trendLines).toHaveLength(1);
  });

  it('filters line sides by the against-trend option', () => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [createBar(0)];

    controller.stepTrendLines(bars, state, 1, 10, true, false);
    bars.push(createBar(1, 12, 12));
    controller.stepTrendLines(bars, state, 1, 10, true, false);

    expect(state.confirmedTrendLines).toHaveLength(1);
    expect(state.confirmedTrendLines![0].position).toBe(TrendLinePosition.Below);
  });

  it('rejects a line crossed inside its left buffer', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(13);
    const state: TrendLineStepState = {
      candidateTrendLines: [{ startIndex: 2, minSlopeBelow: Infinity, maxSlopeAbove: -Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[1].prices.low = 8;
    bars[12] = createBar(12, 20, 20);

    controller.stepTrendLines(bars, state, 10, 100, true, false);

    expect(state.confirmedTrendLines).toHaveLength(0);
  });

  it('rejects an upper line crossed inside its left buffer', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(13);
    const state: TrendLineStepState = {
      candidateTrendLines: [{ startIndex: 2, minSlopeBelow: Infinity, maxSlopeAbove: -Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[1].prices.high = 22;
    bars[2] = createBar(2, 20, 20);
    bars[12] = createBar(12);

    controller.stepTrendLines(bars, state, 10, 100, true, false);

    expect(state.confirmedTrendLines).toHaveLength(0);
  });

  it('does nothing before enough bars exist for a pivot endpoint', () => {
    const controller = new TrendLineController();
    const state: TrendLinesFromPivotPointsStepState = {};

    controller.stepTrendLinesFromPivotPoints([createBar(0)], state, 1, 1, 10, false, false);

    expect(state.candidateTrendLines).toEqual([]);
    expect(state.pendingTrendLines).toEqual([]);
    expect(state.confirmedTrendLines).toEqual([]);
  });

  it('updates one pivot candidate per pivot bar across bars and repeated ticks', () => {
    const controller = new TrendLineController();
    const state: TrendLinesFromPivotPointsStepState = {};
    const bars: Bar[] = [createBar(0)];
    setPivotPoint(bars[0], PivotPointSide.High);

    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 100, 1, false, false);
    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 100, 1, false, false);
    expect(state.candidateTrendLines).toEqual([{ startIndex: 0, side: PivotPointSide.High, extremeSlope: -Infinity }]);

    bars.push(createBar(1, 8, 12));
    setPivotPoint(bars[1], PivotPointSide.Low);
    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 100, 1, false, false);
    bars[1].prices.high = 13;
    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 100, 1, false, false);

    expect(state.candidateTrendLines).toHaveLength(2);
    expect(state.candidateTrendLines![0].extremeSlope).toBe(3);

    bars.push(createBar(2));
    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 100, 1, false, false);

    expect(state.candidateTrendLines!.map(entry => entry.startIndex)).toEqual([1]);
  });

  it('handles a descending lower pivot line and its against-trend filter', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(4);
    const state: TrendLinesFromPivotPointsStepState = {
      candidateTrendLines: [{ startIndex: 0, side: PivotPointSide.Low, extremeSlope: Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[3].prices.low = 7;
    setPivotPoint(bars[3], PivotPointSide.Low);

    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 3, 100, true, false);
    expect(state.confirmedTrendLines).toHaveLength(0);

    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 3, 100, false, false);
    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 3, 100, false, false);

    expect(state.confirmedTrendLines).toHaveLength(1);
    expect(state.confirmedTrendLines![0].position).toBe(TrendLinePosition.Below);
    expect(state.confirmedTrendLines![0].slope).toBe(Slope.Descending);
  });

  it('rejects a pivot line crossed inside its left buffer', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(13);
    const state: TrendLinesFromPivotPointsStepState = {
      candidateTrendLines: [{ startIndex: 2, side: PivotPointSide.High, extremeSlope: -Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[1].prices.high = 22;
    bars[2] = createBar(2, 20, 20);
    setPivotPoint(bars[12], PivotPointSide.High);

    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 10, 100, true, false);

    expect(state.confirmedTrendLines).toHaveLength(0);
  });

  it('queues one pivot line while its right buffer is still open', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(6);
    const state: TrendLinesFromPivotPointsStepState = {
      candidateTrendLines: [{ startIndex: 0, side: PivotPointSide.High, extremeSlope: -Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[5].prices.high = 15;
    setPivotPoint(bars[5], PivotPointSide.High);

    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 5, 100, false, true);
    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 5, 100, false, true);

    expect(state.pendingTrendLines).toHaveLength(1);
    expect(state.confirmedTrendLines).toHaveLength(0);
  });

  it('immediately confirms one pivot line when right buffering is disabled', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(4);
    const state: TrendLinesFromPivotPointsStepState = {
      candidateTrendLines: [{ startIndex: 0, side: PivotPointSide.High, extremeSlope: -Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[3].prices.high = 13;
    setPivotPoint(bars[3], PivotPointSide.High);

    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 3, 100, false, false);
    controller.stepTrendLinesFromPivotPoints(bars, state, 0, 3, 100, false, false);

    expect(state.confirmedTrendLines).toHaveLength(1);
    expect(state.confirmedTrendLines![0].position).toBe(TrendLinePosition.Above);
    expect(bars[0].chart!.trendLines).toHaveLength(1);
  });

  it('confirms one pivot line after an uninterrupted elapsed right buffer', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(6);
    const state: TrendLinesFromPivotPointsStepState = {
      candidateTrendLines: [{ startIndex: 0, side: PivotPointSide.High, extremeSlope: -Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[3].prices.high = 13;
    bars[4].prices.high = 14;
    setPivotPoint(bars[3], PivotPointSide.High);

    controller.stepTrendLinesFromPivotPoints(bars, state, 2, 3, 100, false, true);
    controller.stepTrendLinesFromPivotPoints(bars, state, 2, 3, 100, false, true);

    expect(state.pendingTrendLines).toHaveLength(0);
    expect(state.confirmedTrendLines).toHaveLength(1);
    expect(bars[0].chart!.trendLines).toHaveLength(1);
  });

  it('rejects a pivot line crossed during its elapsed right buffer', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(6);
    const state: TrendLinesFromPivotPointsStepState = {
      candidateTrendLines: [{ startIndex: 0, side: PivotPointSide.High, extremeSlope: -Infinity }],
      pendingTrendLines: [],
      confirmedTrendLines: []
    };
    bars[3].prices.high = 13;
    bars[4].prices.high = 15;
    setPivotPoint(bars[3], PivotPointSide.High);

    controller.stepTrendLinesFromPivotPoints(bars, state, 2, 3, 100, false, true);
    controller.stepTrendLinesFromPivotPoints(bars, state, 2, 3, 100, false, true);

    expect(state.pendingTrendLines).toHaveLength(0);
    expect(state.confirmedTrendLines).toHaveLength(0);
    expect(bars[0].chart?.trendLines).toBeUndefined();
  });

  it('records upper and lower breakthroughs once and removes broken lines on the next pass', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(3);
    const upperLine: TrendLine = createTrendLine({ length: 5, position: TrendLinePosition.Above });
    const lowerLine: TrendLine = createTrendLine({ length: 5, position: TrendLinePosition.Below });
    const state: TrendLineStepState = { confirmedTrendLines: [upperLine, lowerLine] };
    bars[0].chart = { trendLines: [upperLine, lowerLine] };

    controller.stepTrendLineBreakthroughs(bars, state, true);
    expect(state.confirmedTrendLines).toHaveLength(2);
    expect(bars[2].chart?.trendLineBreakthroughs).toBeUndefined();

    bars.push(createBar(3));
    controller.stepTrendLineBreakthroughs(bars, state, true);
    expect(state.confirmedTrendLines).toHaveLength(2);
    expect(bars[3].chart?.trendLineBreakthroughs).toBeUndefined();

    bars[3].prices.high = 11;
    bars[3].prices.low = 9;
    controller.stepTrendLineBreakthroughs(bars, state, true);

    expect(state.confirmedTrendLines).toHaveLength(2);
    expect(state.confirmedTrendLines!.map(line => line.breakThroughIndex)).toEqual([3, 3]);
    expect(bars[3].chart!.trendLineBreakthroughs).toHaveLength(2);

    controller.stepTrendLineBreakthroughs(bars, state, true);

    expect(state.confirmedTrendLines).toHaveLength(0);
    expect(bars[3].chart!.trendLineBreakthroughs).toHaveLength(2);
  });

  it('checks breakthroughs immediately when right buffering is disabled', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(3);
    const trendLine: TrendLine = createTrendLine({ length: 5 });
    const state: TrendLineStepState = { confirmedTrendLines: [trendLine] };
    bars[2].prices.high = 11;

    controller.stepTrendLineBreakthroughs(bars, state, false);

    expect(trendLine.breakThroughIndex).toBe(2);
    expect(bars[2].chart!.trendLineBreakthroughs).toEqual([trendLine]);
  });

  it('deduplicates breakthroughs when repeated state is cloned for the same bar', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(4);
    const retainedLine: TrendLine = createTrendLine({ length: 5 });
    const repeatedLine: TrendLine = cloneTrendLine(retainedLine);
    bars[3].prices.high = 11;
    bars[3].chart = { trendLineBreakthroughs: [retainedLine] };

    controller.stepTrendLineBreakthroughs(bars, { confirmedTrendLines: [repeatedLine] }, true);

    expect(bars[3].chart.trendLineBreakthroughs).toHaveLength(1);
    expect(repeatedLine.breakThroughIndex).toBe(3);
  });

  it('removes an expired line from state and chart when state has been cloned', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(4);
    const chartLine: TrendLine = createTrendLine({ length: 2 });
    const stateLine: TrendLine = cloneTrendLine(chartLine);
    const state: TrendLineStepState = { confirmedTrendLines: [stateLine] };
    bars[0].chart = { trendLines: [chartLine] };

    controller.stepTrendLineBreakthroughs(bars, state, false);

    expect(state.confirmedTrendLines).toHaveLength(0);
    expect(bars[0].chart.trendLines).toHaveLength(0);
  });

  it('removes an expired line when its start bar has no chart data', () => {
    const controller = new TrendLineController();
    const bars: Bar[] = createBars(4);
    const state: TrendLineStepState = { confirmedTrendLines: [createTrendLine({ length: 2 })] };

    expect(() => controller.stepTrendLineBreakthroughs(bars, state, false)).not.toThrow();
    expect(state.confirmedTrendLines).toHaveLength(0);
  });
});