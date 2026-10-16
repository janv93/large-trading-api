import { describe, expect, it } from '@jest/globals';
import { Bar, Exchange, Timeframe, TrendLine, TrendLinePosition, TrendLineStepState } from '@shared';
import TrendLineController from './trend-line';

function createBar(index: number, price: number): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: index * 60_000 },
    prices: { open: price, high: price, low: price, close: price },
    volume: 100,
    backtest: { signals: [] },
  };
}

function setTickPrice(bars: Bar[], price: number): void {
  bars.at(-1)!.prices = { open: price, high: price, low: price, close: price };
}

describe.each([
  { position: TrendLinePosition.Below, direction: 1 },
  { position: TrendLinePosition.Above, direction: -1 },
])('current-bar trend lines $position price', ({ position, direction }) => {
  const reflectPrice = (price: number): number => 110 + direction * (price - 110);

  it('replaces a line only on a crossing and keeps previous objects unchanged', () => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [];

    for (const price of [120, 100, 110, 108, 107, 105, 102]) {
      bars.push(createBar(bars.length, reflectPrice(price)));
      controller.stepTrendLines(bars, state, 5, 5, false, false);
    }

    const findCurrentLine = (): TrendLine | undefined =>
      state.confirmedTrendLines!.find((line) => line.startIndex === 1 && line.endIndex === 6 && line.position === position);

    const first: TrendLine = findCurrentLine()!;
    expect(first).toBeDefined();
    expect(first.function.getY(6)).toBeCloseTo(reflectPrice(102));

    for (const price of [102, 103, 104, 102]) {
      setTickPrice(bars, reflectPrice(price));
      controller.stepTrendLines(bars, state, 5, 5, false, false);
      expect(findCurrentLine()).toBe(first);
      expect(first.function.getY(6)).toBeCloseTo(reflectPrice(102));
    }

    let previous: TrendLine = first;

    for (const price of [99, 95]) {
      const previousFunction = previous.function;
      const previousEndpoint: number = previous.function.getY(6);
      setTickPrice(bars, reflectPrice(price));
      controller.stepTrendLines(bars, state, 5, 5, false, false);
      const replacement: TrendLine = findCurrentLine()!;

      expect(replacement).toBeDefined();
      expect(replacement).not.toBe(previous);
      expect(replacement.function.getY(1)).toBeCloseTo(reflectPrice(100));
      expect(replacement.function.getY(6)).toBeCloseTo(reflectPrice(price));
      expect(state.confirmedTrendLines).not.toContain(previous);
      expect(bars[1].chart?.trendLines).not.toContain(previous);
      expect(bars[1].chart?.trendLines).toContain(replacement);
      expect(bars[1].chart?.trendLines?.filter((line) => line.endIndex === 6 && line.position === position)).toHaveLength(1);
      expect(previous.function).toBe(previousFunction);
      expect(previous.function.getY(6)).toBe(previousEndpoint);
      previous = replacement;
    }

    for (const price of [95, 99, 102]) {
      setTickPrice(bars, reflectPrice(price));
      controller.stepTrendLines(bars, state, 5, 5, false, false);
      expect(findCurrentLine()).toBe(previous);
      expect(previous.function.getY(6)).toBeCloseTo(reflectPrice(95));
    }
  });

  it('removes the crossed line when its replacement fails left-buffer validation', () => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [];

    for (const price of [104, 103, 100, 105, 106, 107, 108, 109, 109, 109, 109, 109, 110]) {
      bars.push(createBar(bars.length, reflectPrice(price)));
      controller.stepTrendLines(bars, state, 10, 10, false, false);
    }

    const original: TrendLine | undefined = state.confirmedTrendLines!.find(
      (line) => line.startIndex === 2 && line.endIndex === 12 && line.position === position,
    );

    expect(original).toBeDefined();
    setTickPrice(bars, reflectPrice(60));
    controller.stepTrendLines(bars, state, 10, 10, false, false);

    expect(
      state.confirmedTrendLines!.filter((line) => line.startIndex === 2 && line.endIndex === 12 && line.position === position),
    ).toEqual([]);
    expect(bars[2].chart?.trendLines?.filter((line) => line.endIndex === 12 && line.position === position)).toEqual([]);
    expect(original!.function.getY(12)).toBeCloseTo(reflectPrice(110));
  });

  it('leaves completed lines fixed and reports their breakthrough only once', () => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [];

    for (const price of [120, 100, 110, 108, 107, 105, 102]) {
      bars.push(createBar(bars.length, reflectPrice(price)));
      controller.stepTrendLines(bars, state, 5, 5, false, false);
    }

    const completed: TrendLine = state.confirmedTrendLines!.find(
      (line) => line.startIndex === 1 && line.endIndex === 6 && line.position === position,
    )!;

    expect(completed).toBeDefined();
    const breakthroughPrice: number = completed.function.getY(7);
    bars.push(createBar(7, reflectPrice(99)));
    controller.stepTrendLines(bars, state, 5, 5, false, false);

    expect(state.confirmedTrendLines).toContain(completed);
    expect(completed.function.getY(6)).toBeCloseTo(reflectPrice(102));
    expect(controller.stepTrendLineBreakthroughs(bars, state, false)).toContain(completed);
    expect(completed.breakThroughIndex).toBe(7);

    for (const price of [103, 98, 104]) {
      setTickPrice(bars, reflectPrice(price));
      controller.stepTrendLines(bars, state, 5, 5, false, false);
      expect(controller.stepTrendLineBreakthroughs(bars, state, false)).not.toContain(completed);
      expect(bars[7].chart?.trendLineBreakthroughs).toContain(completed);
      expect(bars[7].chart?.trendLineBreakthroughs?.filter((line) => line === completed)).toHaveLength(1);
      expect(bars[1].chart?.trendLines).toContain(completed);
      expect(completed.function.getY(7)).toBe(breakthroughPrice);
    }
  });

  it('creates a buffered line only after its endpoint has closed', () => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [];
    const matchesLine = (line: TrendLine): boolean => line.startIndex === 1 && line.endIndex === 41 && line.position === position;
    const step = (): void => controller.stepTrendLines(bars, state, 40, 40, false, true);

    for (const price of [120, 100, ...Array(39).fill(110), 102]) {
      bars.push(createBar(bars.length, reflectPrice(price)));
      step();
    }

    const ticks: number[] = [102, 99, 104, 95, 102].map(reflectPrice);

    for (const price of ticks) {
      setTickPrice(bars, price);
      step();
      expect(state.pendingTrendLines!.filter(matchesLine)).toEqual([]);
      expect(state.confirmedTrendLines!.filter(matchesLine)).toEqual([]);
    }

    bars.at(-1)!.prices = { open: ticks[0], high: Math.max(...ticks), low: Math.min(...ticks), close: ticks.at(-1)! };
    bars.push(createBar(bars.length, reflectPrice(104)));
    step();

    const pending: TrendLine = state.pendingTrendLines!.find(matchesLine)!;
    expect(pending).toBeDefined();
    expect(pending.function.getY(41)).toBeCloseTo(reflectPrice(95));

    for (const price of [90, 110, 95]) {
      setTickPrice(bars, reflectPrice(price));
      step();
      expect(state.pendingTrendLines!.filter(matchesLine)).toEqual([pending]);
      expect(pending.function.getY(41)).toBeCloseTo(reflectPrice(95));
      expect(state.confirmedTrendLines!.filter(matchesLine)).toEqual([]);
    }
  });

  it('waits for a closed endpoint even with a zero-length buffer and does not revive a broken line', () => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [];
    const matchesLine = (line: TrendLine): boolean => line.startIndex === 1 && line.endIndex === 3 && line.position === position;
    const step = (): void => controller.stepTrendLines(bars, state, 2, 2, false, true);

    for (const price of [120, 100, 110, 102]) {
      bars.push(createBar(bars.length, reflectPrice(price)));
      step();
    }

    expect(state.confirmedTrendLines!.filter(matchesLine)).toEqual([]);
    bars.push(createBar(bars.length, reflectPrice(99)));
    step();

    const confirmed: TrendLine = state.confirmedTrendLines!.find(matchesLine)!;
    expect(confirmed).toBeDefined();
    expect(state.pendingTrendLines).toEqual([]);
    expect(controller.stepTrendLineBreakthroughs(bars, state, true)).toContain(confirmed);

    for (const price of [104, 99, 104, 99]) {
      setTickPrice(bars, reflectPrice(price));
      step();
      expect(controller.stepTrendLineBreakthroughs(bars, state, true)).toEqual([]);
      expect(state.confirmedTrendLines!.filter(matchesLine)).toEqual([]);
      expect(state.pendingTrendLines).toEqual([]);
      expect(bars[1].chart?.trendLines?.filter(matchesLine)).toEqual([confirmed]);
      expect(bars[4].chart?.trendLineBreakthroughs?.filter(matchesLine)).toEqual([confirmed]);
    }
  });

  it.each([false, true])('decides only after the full right buffer closes, with crossing: %s', (lateCrossing) => {
    const controller = new TrendLineController();
    const state: TrendLineStepState = {};
    const bars: Bar[] = [];

    const step = (): TrendLine[] => {
      controller.stepTrendLines(bars, state, 40, 200, true, true);
      return controller.stepTrendLineBreakthroughs(bars, state, true);
    };

    for (const price of [120, 100, ...Array(39).fill(110), 102, 104]) {
      bars.push(createBar(bars.length, reflectPrice(price)));
      step();
    }

    const pending: TrendLine = state.pendingTrendLines!.find(
      (line) => line.startIndex === 1 && line.endIndex === 41 && line.position === position,
    )!;

    expect(pending).toBeDefined();

    for (let bufferIndex = 0; bufferIndex < 7; bufferIndex++) {
      bars.push(createBar(bars.length, reflectPrice(104)));
      expect(step()).not.toContain(pending);
      expect(state.pendingTrendLines).toContain(pending);
      expect(state.confirmedTrendLines).not.toContain(pending);
      expect(bars[1].chart?.trendLines ?? []).not.toContain(pending);
    }

    const ticks: number[] = (lateCrossing ? [104, 99, 104] : [104, 105, 104]).map(reflectPrice);

    for (const price of ticks) {
      setTickPrice(bars, price);
      expect(step()).not.toContain(pending);
      expect(state.pendingTrendLines).toContain(pending);
      expect(state.confirmedTrendLines).not.toContain(pending);
      expect(bars[1].chart?.trendLines ?? []).not.toContain(pending);
    }

    bars.at(-1)!.prices = { open: ticks[0], high: Math.max(...ticks), low: Math.min(...ticks), close: ticks.at(-1)! };
    bars.push(createBar(bars.length, reflectPrice(99)));
    const breakthroughs: TrendLine[] = step();
    expect(breakthroughs.includes(pending)).toBe(!lateCrossing);
    expect(pending.breakThroughIndex).toBe(lateCrossing ? undefined : 50);
    expect(bars[1].chart?.trendLines?.includes(pending) ?? false).toBe(!lateCrossing);
    expect(state.pendingTrendLines).not.toContain(pending);
    expect(step()).not.toContain(pending);
    expect(bars[50].chart?.trendLineBreakthroughs?.filter((line) => line === pending) ?? []).toHaveLength(lateCrossing ? 0 : 1);
  });
});
