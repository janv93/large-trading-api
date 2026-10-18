import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  BacktesterState,
  Bar,
  Exchange,
  LinearFunction,
  LiveStrategyState,
  Signal,
  Slope,
  Timeframe,
  TrendLine,
  TrendLinePosition,
  createSignal,
} from '@shared';
import TrendLineController from '../../patterns/trend-line/trend-line';
import MeanReversion from '../../strategies/mean-reversion';
import RsiDivergence from '../../strategies/rsi-divergence';
import Backtester from '../backtester/backtester';
import LiveWorkerLifecycle from './worker-lifecycle';

class RecordingBacktester {
  public readonly calls: any[] = [];

  public stepCalcBacktestPerformance(bars: Bar[], state: BacktesterState): void {
    const bar: Bar = bars.at(-1)!;

    this.calls.push({
      openTime: bar.times.open,
      incomingProfit: state.profit ?? 0,
      signalIdentifiers: bar.backtest.signals.map((signal) => signal.uniqueIdentifier),
    });

    state.profit = (state.profit ?? 0) + bar.prices.close;
    bar.backtest.profit = state.profit;
  }
}

class CumulativeStrategy {
  public activeCalls = 0;

  public stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
    if (bars.length === 1) return;

    this.activeCalls++;
    const bar: Bar = bars.at(-1)!;
    const price: number = bar.prices.close;
    const pattern = this.activeCalls === 1 ? { hammer: true } : { doji: true };
    const previousDivergence = bar.indicators?.rsiDivergence;
    const previousBreakthroughs = bar.chart?.trendLineBreakthroughs ?? [];

    bar.candlestickPatterns = { ...bar.candlestickPatterns, ...pattern };

    bar.indicators = {
      rsiDivergence: {
        regular: (previousDivergence?.regular ?? 0) + 1,
        originTrendLines: [...(previousDivergence?.originTrendLines ?? []), createTrendLine(this.activeCalls)],
      },
    };
    bar.chart = {
      trendLineBreakthroughs: [...previousBreakthroughs, createTrendLine(this.activeCalls)],
    };
    bar.backtest.signals.push(
      createSignal({
        uniqueIdentifier: 'one-entry',
        signal: Signal.Buy,
        size: 1,
        price,
      }),
    );

    state.lastPrice = price;
  }
}

class FreezingStrategy {
  public readonly incomingBarDone: (boolean | undefined)[] = [];
  public readonly incomingMarkers: (number | undefined)[] = [];
  public calls = 0;

  public stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
    const bar: Bar = bars.at(-1)!;

    if (bars.length === 1) {
      state.marker = 0;
      return;
    }

    this.calls++;
    this.incomingBarDone.push(state.barDone);
    this.incomingMarkers.push(state.marker);
    state.marker = bar.prices.close;

    if (bar.prices.close === 13) {
      bar.indicators = { ema: { 1: bar.prices.close } };

      bar.backtest.signals.push({
        signal: Signal.Buy,
        size: 1,
        price: bar.prices.close,
      });

      state.barDone = true;
    }
  }
}

class DuplicateBuyStrategy {
  public stepSetSignals(bars: Bar[]): void {
    if (bars.length === 1) return;
    const bar: Bar = bars.at(-1)!;

    bar.backtest.signals.push(
      createSignal({
        uniqueIdentifier: Signal.Buy,
        signal: Signal.Buy,
        size: 1,
        price: bar.prices.close,
      }),
    );
  }
}

class CompletingDuplicateBuyStrategy {
  public stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
    if (bars.length === 1) return;
    const bar: Bar = bars.at(-1)!;

    bar.backtest.signals.push(
      createSignal({
        uniqueIdentifier: Signal.Buy,
        signal: Signal.Buy,
        size: 1,
        price: bar.prices.close,
      }),
    );

    if (bar.prices.close === 102) state.barDone = true;
  }
}

class TrailingEntryStrategy {
  public stepSetSignals(bars: Bar[]): void {
    if (bars.length === 1) return;
    const bar: Bar = bars.at(-1)!;

    bar.backtest.signals.push(
      createSignal({
        uniqueIdentifier: 'trailing-entry',
        signal: Signal.Buy,
        size: 1,
        price: bar.prices.close,
        positionCloseTrigger: { tSl: { stopLoss: 0.1 } },
      }),
    );
  }
}

class StopLossStrategy {
  public stepSetSignals(bars: Bar[]): void {
    if (bars.length !== 1) return;

    const bar: Bar = bars[0];

    bar.backtest.signals.push(
      createSignal({
        uniqueIdentifier: 'stop-loss-entry',
        signal: Signal.Buy,
        size: 1,
        price: bar.prices.close,
        positionCloseTrigger: { tpSl: { takeProfit: 0.2, stopLoss: 0.1 } },
      }),
    );
  }
}

class VolatilityEntryStrategy {
  public stepSetSignals(bars: Bar[]): void {
    if (bars.length !== 3) return;
    const bar: Bar = bars.at(-1)!;

    bar.backtest.signals.push(
      createSignal({
        uniqueIdentifier: 'volatility-entry',
        signal: Signal.Buy,
        size: 1,
        price: bar.prices.close,
        positionCloseTrigger: { tpSl: { takeProfit: 1, stopLoss: 1, asVolatilityFactor: true } },
      }),
    );
  }
}

class BarReferenceStrategy {
  public referencesMatched = true;
  public bars?: Bar[];
  public state?: LiveStrategyState;

  public stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
    if (bars.length === 1) {
      this.bars = bars;
      this.state = state;
      state.reference = bars[0];
      return;
    }

    this.referencesMatched &&= state.reference === bars[0] && this.bars === bars && this.state === state;
    state.reference.chart = { marketStructure: { streak: bars.length, direction: 'UP' } };
  }
}

class RetainedBreakthroughStrategy {
  public readonly incomingConfirmedCounts: number[] = [];
  public readonly incomingOriginBreakThroughIndexes: (number | undefined)[] = [];
  public readonly newBreakthroughCounts: number[] = [];
  private readonly controller = new TrendLineController();

  public stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
    state.trendLines ??= {};

    if (bars.length === 1) {
      const trendLine: TrendLine = {
        function: new LinearFunction(0, 10),
        startIndex: 0,
        endIndex: 0,
        length: 2,
        slope: Slope.Ascending,
        position: TrendLinePosition.Above,
      };

      state.trendLines.confirmedTrendLines = [trendLine];
      bars[0].chart = { trendLines: [trendLine] };
      return;
    }

    this.incomingConfirmedCounts.push(state.trendLines.confirmedTrendLines.length);
    this.incomingOriginBreakThroughIndexes.push(bars[0].chart?.trendLines?.[0]?.breakThroughIndex);
    const breakthroughs: TrendLine[] = this.controller.stepTrendLineBreakthroughs(bars, state.trendLines, false);
    this.newBreakthroughCounts.push(breakthroughs.length);
  }
}

class AccumulatingConfirmedTrendLineStrategy {
  public readonly incomingConfirmedCounts: number[] = [];
  public readonly incomingChartCounts: number[] = [];
  public readonly retainedReferencesMatched: boolean[] = [];

  public stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
    state.trendLines ??= {};
    state.trendLines.confirmedTrendLines ??= [];
    if (bars.length === 1) return;

    this.incomingConfirmedCounts.push(state.trendLines.confirmedTrendLines.length);
    this.incomingChartCounts.push(bars[0].chart?.trendLines?.length ?? 0);

    if (state.trendLines.confirmedTrendLines.length > 0) {
      this.retainedReferencesMatched.push(state.trendLines.confirmedTrendLines[0] === bars[0].chart?.trendLines?.[0]);
    }

    if (state.trendLines.confirmedTrendLines.length > 0) return;

    const trendLine: TrendLine = createTrendLine(bars.length - 1);
    state.trendLines.confirmedTrendLines.push(trendLine);
    bars[trendLine.startIndex].chart ??= {};
    bars[trendLine.startIndex].chart!.trendLines = [trendLine];
  }
}

class ExpiringTrendLineStrategy {
  public readonly incomingConfirmedCounts: number[] = [];
  public readonly incomingChartCounts: number[] = [];
  private readonly controller = new TrendLineController();

  public stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
    state.trendLines ??= {};

    if (bars.length === 1) {
      const trendLine: TrendLine = createTrendLine(0);
      state.trendLines.confirmedTrendLines = [trendLine];
      bars[0].chart = { trendLines: [trendLine] };
      return;
    }

    this.incomingConfirmedCounts.push(state.trendLines.confirmedTrendLines.length);
    this.incomingChartCounts.push(bars[0].chart?.trendLines?.length ?? 0);
    this.controller.stepTrendLineBreakthroughs(bars, state.trendLines, false);
  }
}

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

function createTrendLine(endIndex: number): TrendLine {
  return {
    function: new LinearFunction(0, 10, endIndex, 10 + endIndex),
    startIndex: 0,
    endIndex,
    length: endIndex,
    slope: Slope.Ascending,
    position: TrendLinePosition.Below,
  };
}

function createTickPaths(seed: number, barCount: number): number[][] {
  let randomState: number = seed;
  let price: number = 100;
  const tickPaths: number[][] = [];

  const random = (): number => {
    randomState = (randomState * 16807) % 2147483647;
    return randomState / 2147483647;
  };

  // a coarse price grid creates ties between slopes and line touches
  const roundToGrid = (value: number): number => Math.round(value * 4) / 4;

  for (let barIndex = 0; barIndex < barCount; barIndex++) {
    const ticks: number[] = [roundToGrid(price)];
    const tickCount: number = 1 + Math.floor(random() * 5);

    for (let tick = 0; tick < tickCount; tick++) {
      price = Math.max(1, price + (random() - 0.5) * 3);
      ticks.push(roundToGrid(price));
    }

    tickPaths.push(ticks);
  }

  return tickPaths;
}

function createBarFromTicks(ticks: number[], barIndex: number): Bar {
  const bar: Bar = createBar(barIndex * 60_000, ticks[0]);
  bar.prices = { open: ticks[0], high: Math.max(...ticks), low: Math.min(...ticks), close: ticks.at(-1)! };
  return bar;
}

function getTrendLineKey(trendLine: TrendLine): string {
  return `${trendLine.startIndex}:${trendLine.endIndex}:${trendLine.position}`;
}

function getOriginKeys(bar: Bar): string[] {
  return (bar.indicators?.rsiDivergence?.originTrendLines ?? []).map(getTrendLineKey);
}

function getChartLineEndPrices(bars: Bar[]): Map<string, number> {
  const endPrices = new Map<string, number>();

  for (const bar of bars) {
    for (const trendLine of bar.chart?.trendLines ?? []) {
      endPrices.set(getTrendLineKey(trendLine), trendLine.function.getY(trendLine.endIndex));
    }
  }

  return endPrices;
}

function createLifecycle(strategyInstance: any, backtesterInstance: any, strategyConfig: any = {}): LiveWorkerLifecycle {
  return new LiveWorkerLifecycle({
    strategyInstance,
    backtesterInstance,
    strategyConfig,
    timeframeMs: 60_000,
    commission: 0,
  });
}

describe('live worker lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retains cumulative discoveries while replacing each tick price and deduplicating signals', async () => {
    const strategy = new CumulativeStrategy();
    const backtester = new RecordingBacktester();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, backtester);
    await lifecycle.initialize([createBar(0, 10)]);

    const first: Bar = await lifecycle.processTick(11);
    expect(first.prices).toEqual({ open: 11, high: 11, low: 11, close: 11 });

    first.backtest.signals.push(
      createSignal({
        uniqueIdentifier: 'backtester-close',
        signal: Signal.StopLoss,
        price: 9,
      }),
    );

    const second: Bar = await lifecycle.processTick(12);

    expect(second).toBe(first);
    expect(second.prices).toEqual({ open: 12, high: 12, low: 12, close: 12 });
    expect(second.times.open).toBe(60_000);
    expect(second.candlestickPatterns).toEqual({ hammer: true, doji: true });
    expect(second.indicators?.rsiDivergence?.regular).toBe(2);
    expect(second.indicators?.rsiDivergence?.originTrendLines).toHaveLength(2);
    expect(second.chart?.trendLineBreakthroughs).toHaveLength(2);
    expect(second.backtest.signals.map((signal) => signal.uniqueIdentifier)).toEqual(['"one-entry"', '"backtester-close"']);
    expect(second.backtest.signals[0].price).toBe(11);
    expect(backtester.calls.at(-1)?.signalIdentifiers).toEqual(['"one-entry"', '"backtester-close"']);
    expect(first.times.open).toBe(second.times.open);
  });

  it.each([{ initialTicks: [] }, { initialTicks: [102] }])(
    'detects and retains a new RSI divergence after initial ticks $initialTicks',
    async ({ initialTicks }) => {
      const lifecycle: LiveWorkerLifecycle = createLifecycle(new RsiDivergence(), new Backtester(), {
        minLength: 5,
        maxLength: 5,
        minStrength: 0.01,
        stopLoss: 0.1,
      });

      const history: Bar[] = [120, 100, 110, 108, 107, 105].map((price, index) => createBar(index * 60_000, price));
      await lifecycle.initialize(history);

      for (const bar of history) {
        expect(bar.indicators?.rsiDivergence).toBeUndefined();
        expect(bar.backtest.signals).toEqual([]);
      }

      for (const price of initialTicks) {
        const tick: Bar = await lifecycle.processTick(price);
        expect(tick.indicators?.rsiDivergence).toBeUndefined();
        expect(tick.backtest.signals).toEqual([]);
        expect(tick.backtest.openPositionSize).toBe(0);
      }

      const discovered: Bar = await lifecycle.processTick(99);
      const divergence = discovered.indicators?.rsiDivergence;
      expect(divergence?.regular).toBeGreaterThan(0);
      expect(divergence?.originTrendLines).toHaveLength(1);
      expect(divergence?.originTrendLines[0]).toMatchObject({ startIndex: 1, endIndex: 6, position: TrendLinePosition.Below });
      expect(history[1].chart?.trendLines).toContain(divergence?.originTrendLines[0]);
      const strength: number = divergence!.regular!;
      expect(discovered.backtest.signals).toHaveLength(1);
      expect(discovered.backtest.signals[0]).toMatchObject({ signal: Signal.Buy, size: strength, price: 99 });
      expect(discovered.backtest.openPositionSize).toBeCloseTo(strength);

      for (const price of [99, 102, 101]) {
        const tick: Bar = await lifecycle.processTick(price);
        expect(tick.indicators?.rsiDivergence).toBe(divergence);
        expect(tick.indicators?.rsiDivergence?.regular).toBe(strength);
        expect(tick.indicators?.rsiDivergence?.originTrendLines).toHaveLength(1);
        expect(history[1].chart?.trendLines).toContain(divergence?.originTrendLines[0]);
        expect(tick.backtest.signals).toHaveLength(1);
        expect(tick.backtest.signals[0]).toMatchObject({ signal: Signal.Buy, size: strength, price: 99 });
        expect(tick.backtest.openPositionSize).toBeCloseTo((strength * price) / 99);
      }

      const stopped: Bar = await lifecycle.processTick(90);
      expect(stopped.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.Buy, Signal.StopLoss]);
      expect(stopped.backtest.openPositionSize).toBe(0);

      const replacement: TrendLine | undefined = history[1].chart?.trendLines?.find(
        (line) => line.endIndex === 6 && line.position === TrendLinePosition.Below,
      );

      expect(replacement).toBeDefined();
      expect(replacement).not.toBe(divergence?.originTrendLines[0]);
      expect(replacement?.function.getY(6)).toBeCloseTo(90);
      expect(divergence?.originTrendLines[0].function.getY(6)).toBeCloseTo(99);

      const rebounded: Bar = await lifecycle.processTick(102);
      expect(rebounded.indicators?.rsiDivergence).toBe(divergence);
      expect(rebounded.indicators?.rsiDivergence?.regular).toBe(strength);
      expect(rebounded.indicators?.rsiDivergence?.originTrendLines).toHaveLength(1);
      expect(divergence?.originTrendLines[0].function.getY(6)).toBeCloseTo(99);
      expect(history[1].chart?.trendLines).toContain(replacement);
      expect(replacement?.function.getY(6)).toBeCloseTo(90);
      expect(rebounded.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.Buy, Signal.StopLoss]);
      expect(rebounded.backtest.openPositionSize).toBe(0);
    },
  );

  it.each(Array.from({ length: 20 }, (_, index) => index + 1))(
    'finds every backtested RSI divergence and its trend line live for seed %s',
    async (seed) => {
      const params = { minLength: 5, maxLength: 30, minStrength: 0.1, stopLoss: 0.1 };
      const warmupBarCount: number = 40;
      const tickPaths: number[][] = createTickPaths(seed, 300);
      const backtestStrategy = new RsiDivergence();
      const backtestState: LiveStrategyState = {};
      const backtestBars: Bar[] = [];

      tickPaths.forEach((ticks, barIndex) => {
        backtestBars.push(createBarFromTicks(ticks, barIndex));
        backtestStrategy.stepSetSignals(backtestBars, backtestState, params);
      });

      const liveBars: Bar[] = tickPaths.slice(0, warmupBarCount).map(createBarFromTicks);
      const lifecycle: LiveWorkerLifecycle = createLifecycle(new RsiDivergence(), new RecordingBacktester(), params);
      await lifecycle.initialize([...liveBars]);
      const now = jest.spyOn(Date, 'now');

      for (let barIndex = warmupBarCount; barIndex < tickPaths.length; barIndex++) {
        for (const tick of tickPaths[barIndex]) await lifecycle.processTick(tick);
        now.mockReturnValue((barIndex + 1) * 60_000);
        liveBars.push(lifecycle.finalizeBar()!);
      }

      const liveLineEndPrices: Map<string, number> = getChartLineEndPrices(liveBars);
      const backtestLineEndPrices: Map<string, number> = getChartLineEndPrices(backtestBars);
      let backtestDivergenceCount: number = 0;

      for (let barIndex = warmupBarCount; barIndex < tickPaths.length; barIndex++) {
        expect(liveBars[barIndex].prices).toEqual(backtestBars[barIndex].prices);
        expect(getOriginKeys(liveBars[barIndex])).toEqual(expect.arrayContaining(getOriginKeys(backtestBars[barIndex])));
        backtestDivergenceCount += getOriginKeys(backtestBars[barIndex]).length;
      }

      expect(backtestDivergenceCount).toBeGreaterThan(0);

      backtestLineEndPrices.forEach((endPrice, lineKey) => {
        if (Number(lineKey.split(':')[0]) < warmupBarCount) return;
        expect(liveLineEndPrices.get(lineKey)).toBeCloseTo(endPrice, 9);
      });

      liveLineEndPrices.forEach((_, lineKey) => {
        const endIndex: number = Number(lineKey.split(':')[1]);
        if (endIndex < liveBars.length - 1) expect(getOriginKeys(liveBars[endIndex])).toContain(lineKey);
      });
    },
  );

  it('deduplicates retained strategy signals before the real backtester opens positions', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new DuplicateBuyStrategy(), new Backtester());
    await lifecycle.initialize([createBar(0, 100)]);

    await lifecycle.processTick(101);
    const second: Bar = await lifecycle.processTick(102);

    expect(second.backtest.signals).toHaveLength(1);
    expect(second.backtest.signals[0].price).toBe(101);
    expect(second.backtest.openPositionSize).toBeCloseTo(102 / 101);
  });

  it('deduplicates retained strategy signals when the strategy completes', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new CompletingDuplicateBuyStrategy(), new Backtester());
    await lifecycle.initialize([createBar(0, 100)]);

    await lifecycle.processTick(101);
    const completed: Bar = await lifecycle.processTick(102);

    expect(completed.backtest.signals).toHaveLength(1);
    expect(completed.backtest.signals[0].price).toBe(101);
    expect(completed.backtest.openPositionSize).toBeCloseTo(102 / 101);
  });

  it('carries a position across ticks and never reopens its retained entry after it closes', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new TrailingEntryStrategy(), new Backtester());
    await lifecycle.initialize([createBar(0, 100)]);

    const opened: Bar = await lifecycle.processTick(110);
    expect(opened.backtest.openPositionSize).toBe(1);

    const trailed: Bar = await lifecycle.processTick(130);
    expect(trailed.backtest.openPositionSize).toBeCloseTo(1.181818);

    const stopped: Bar = await lifecycle.processTick(100);
    expect(stopped.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.Buy, Signal.StopLoss]);
    expect(stopped.backtest.openPositionSize).toBe(0);

    const rebounded: Bar = await lifecycle.processTick(120);
    expect(rebounded.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.Buy, Signal.StopLoss]);
    expect(rebounded.backtest.openPositionSize).toBe(0);
    expect(rebounded.backtest.profit).toBeCloseTo(0.063636);
  });

  it('stops a completed production strategy while continuing its position on later ticks', async () => {
    const strategy = new MeanReversion();
    const stepSetSignals = jest.spyOn(strategy, 'stepSetSignals');

    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, new Backtester(), {
      startStreak: 0,
      threshold: 0.05,
      profitBasedTrailingStopLoss: 0.5,
    });

    await lifecycle.initialize([createBar(0, 100)]);

    const completed: Bar = await lifecycle.processTick(70);
    const strategyCallsAtCompletion: number = stepSetSignals.mock.calls.length;

    expect(completed.backtest.signals.map((signal) => signal.signal)).toContain(Signal.Buy);
    expect(completed.backtest.signals.find((signal) => signal.signal === Signal.Buy)?.uniqueIdentifier).toBeUndefined();
    expect(completed.backtest.openPositionSize).toBe(1);

    const continued: Bar = await lifecycle.processTick(95);

    expect(continued).toBe(completed);
    expect(continued.prices.close).toBe(95);
    expect(continued.backtest.signals.find((signal) => signal.signal === Signal.Buy)?.price).toBe(70);
    expect(continued.backtest.openPositionSize).toBeCloseTo(95 / 70);
    expect(stepSetSignals).toHaveBeenCalledTimes(strategyCallsAtCompletion);
  });

  it('keeps mean-reversion buys and their size progression to once per bar', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new MeanReversion(), new Backtester(), {
      startStreak: 0,
      threshold: 0.05,
      profitBasedTrailingStopLoss: 0.5,
    });

    await lifecycle.initialize([createBar(0, 100)]);

    const bought: Bar = await lifecycle.processTick(70);
    expect(bought.backtest.signals).toHaveLength(1);
    expect(bought.backtest.signals[0]).toMatchObject({ signal: Signal.Buy, size: 1, price: 70 });
    expect(bought.backtest.openPositionSize).toBe(1);

    for (const price of [70, 65, 60]) {
      const tick: Bar = await lifecycle.processTick(price);
      expect(tick.backtest.signals).toHaveLength(1);
      expect(tick.backtest.signals[0]).toMatchObject({ signal: Signal.Buy, size: 1, price: 70 });
      expect(tick.backtest.openPositionSize).toBeCloseTo(price / 70);
    }

    jest.spyOn(Date, 'now').mockReturnValue(120_000);
    expect(lifecycle.finalizeBar()).toBe(bought);

    const nextBuy: Bar = await lifecycle.processTick(60);
    expect(nextBuy.backtest.signals).toHaveLength(1);
    expect(nextBuy.backtest.signals[0]).toMatchObject({ signal: Signal.Buy, size: 2, price: 60 });
    expect(nextBuy.backtest.openPositionSize).toBeCloseTo(60 / 70 + 2);

    for (const price of [60, 55, 50]) {
      const tick: Bar = await lifecycle.processTick(price);
      expect(tick.backtest.signals).toHaveLength(1);
      expect(tick.backtest.signals[0]).toMatchObject({ signal: Signal.Buy, size: 2, price: 60 });
      expect(tick.backtest.openPositionSize).toBeCloseTo(price / 70 + (2 * price) / 60);
    }
  });

  it.each([false, true])('retains the mean-reversion trailing peak and closes once (new bar before drop: %s)', async (newBarBeforeDrop) => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(120_000);

    const lifecycle: LiveWorkerLifecycle = createLifecycle(new MeanReversion(), new Backtester(), {
      startStreak: 0,
      threshold: 0.05,
      profitBasedTrailingStopLoss: 0.5,
    });

    await lifecycle.initialize([createBar(0, 100), createBar(60_000, 70)]);

    for (const price of [78, 82, 81, 100, 99, 86]) {
      const tick: Bar = await lifecycle.processTick(price);
      expect(tick.backtest.signals).toEqual([]);
      expect(tick.backtest.openPositionSize).toBeCloseTo(price / 70);
    }

    if (newBarBeforeDrop) {
      now.mockReturnValue(180_000);
      expect(lifecycle.finalizeBar()?.prices).toEqual({ open: 78, high: 100, low: 78, close: 86 });
    }

    const closed: Bar = await lifecycle.processTick(84);
    expect(closed.backtest.signals).toHaveLength(1);
    expect(closed.backtest.signals[0]).toMatchObject({ signal: Signal.Close, price: 84 });
    expect(closed.backtest.openPositionSize).toBe(0);
    expect(closed.backtest.profit).toBeCloseTo(0.2);

    for (const price of [84, 60, 100]) {
      const tick: Bar = await lifecycle.processTick(price);
      expect(tick.backtest.signals).toHaveLength(1);
      expect(tick.backtest.signals[0]).toMatchObject({ signal: Signal.Close, price: 84 });
      expect(tick.backtest.openPositionSize).toBe(0);
      expect(tick.backtest.profit).toBeCloseTo(0.2);
    }

    now.mockReturnValue(closed.times.open + 60_000);
    expect(lifecycle.finalizeBar()).toBe(closed);

    const restarted: Bar = await lifecycle.processTick(60);
    expect(restarted.backtest.signals).toHaveLength(1);
    expect(restarted.backtest.signals[0]).toMatchObject({ signal: Signal.Buy, size: 1, price: 60 });
    expect(restarted.backtest.openPositionSize).toBe(1);
  });

  it('keeps a retained stop-loss applied after a later tick moves away from its trigger', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new StopLossStrategy(), new Backtester());
    await lifecycle.initialize([createBar(0, 100)]);

    const triggered: Bar = await lifecycle.processTick(89);
    const rebounded: Bar = await lifecycle.processTick(100);

    expect(triggered.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.StopLoss]);
    expect(triggered.backtest.signals[0]).not.toHaveProperty('uniqueIdentifier');
    expect(triggered.backtest.openPositionSize).toBe(0);
    expect(rebounded.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.StopLoss]);
    expect(rebounded.backtest.signals[0]).toEqual(triggered.backtest.signals[0]);
    expect(rebounded.backtest.openPositionSize).toBe(0);
  });

  it('scales volatility-based exits by the observed range of the completed bar', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new VolatilityEntryStrategy(), new Backtester());
    await lifecycle.initialize([createBar(0, 100)]);

    for (const price of [100, 120, 80, 100]) await lifecycle.processTick(price);
    jest.spyOn(Date, 'now').mockReturnValue(120_000);
    lifecycle.finalizeBar();
    await lifecycle.processTick(100);
    const dipped: Bar = await lifecycle.processTick(70);

    expect(dipped.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.Buy]);
    expect(dipped.backtest.openPositionSize).toBeCloseTo(0.7);
  });

  it('shares the bars array, earlier bars, and strategy state across ticks and bar boundaries', async () => {
    const strategy = new BarReferenceStrategy();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, new RecordingBacktester());
    const initialBar: Bar = createBar(0, 10);
    await lifecycle.initialize([initialBar]);

    const active: Bar = await lifecycle.processTick(11);
    expect(await lifecycle.processTick(12)).toBe(active);
    jest.spyOn(Date, 'now').mockReturnValue(120_000);
    const finalized: Bar | undefined = lifecycle.finalizeBar();
    const next: Bar = await lifecycle.processTick(13);

    expect(strategy.referencesMatched).toBe(true);
    expect(strategy.bars).toHaveLength(3);
    expect(strategy.bars?.[0]).toBe(initialBar);
    expect(strategy.bars?.[1]).toBe(finalized);
    expect(strategy.bars?.[2]).toBe(next);
    expect(finalized).toBe(active);
    expect(finalized?.times.open).toBe(60_000);
    expect(initialBar.chart?.marketStructure?.streak).toBe(3);
  });

  it('keeps a retained trend-line breakthrough retired after a later tick rebounds', async () => {
    const strategy = new RetainedBreakthroughStrategy();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, new RecordingBacktester());
    await lifecycle.initialize([createBar(0, 10)]);

    const crossed: Bar = await lifecycle.processTick(11);
    const rebounded: Bar = await lifecycle.processTick(9);

    expect(crossed.chart?.trendLineBreakthroughs).toHaveLength(1);
    expect(rebounded.chart?.trendLineBreakthroughs).toHaveLength(1);

    jest.spyOn(Date, 'now').mockReturnValue(120_000);
    lifecycle.finalizeBar();
    await lifecycle.processTick(9);

    expect(strategy.incomingConfirmedCounts).toEqual([1, 1, 0]);
    expect(strategy.incomingOriginBreakThroughIndexes).toEqual([undefined, 1, 1]);
    expect(strategy.newBreakthroughCounts).toEqual([1, 0, 0]);
  });

  it('accumulates confirmed trend lines between active ticks', async () => {
    const strategy = new AccumulatingConfirmedTrendLineStrategy();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, new RecordingBacktester());
    await lifecycle.initialize([createBar(0, 10)]);

    await lifecycle.processTick(11);
    await lifecycle.processTick(12);

    expect(strategy.incomingConfirmedCounts).toEqual([0, 1]);
    expect(strategy.incomingChartCounts).toEqual([0, 1]);
    expect(strategy.retainedReferencesMatched).toEqual([true]);
  });

  it.each([
    { prices: [11, 9], remaining: 0, incomingSlopes: [Infinity, expect.closeTo(1 / 11, 10)] },
    {
      prices: [9, 11, 9],
      remaining: 0,
      incomingSlopes: [Infinity, expect.closeTo(-1 / 11, 10), expect.closeTo(-1 / 11, 10)],
    },
    { prices: [9, 9], remaining: 1, incomingSlopes: [Infinity, expect.closeTo(-1 / 11, 10)] },
  ])('carries the trend-line state across ticks $prices', async ({ prices, remaining, incomingSlopes }) => {
    const controller = new TrendLineController();
    const pendingCounts: number[] = [];
    const confirmedCounts: number[] = [];
    const candidateSlopes: number[] = [];

    const strategy = {
      stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
        if (bars.length < 11) return;

        if (bars.length === 11) {
          state.trendLines = {
            candidateTrendLines: [{ startIndex: 0, minSlopeBelow: Infinity, maxSlopeAbove: -Infinity }],
            pendingTrendLines: [
              {
                function: new LinearFunction(0, 10, 10, 10),
                startIndex: 0,
                endIndex: 10,
                length: 10,
                slope: Slope.Descending,
                position: TrendLinePosition.Above,
              },
            ],
            confirmedTrendLines: [],
          };

          return;
        }

        candidateSlopes.push(state.trendLines.candidateTrendLines[0].minSlopeBelow);
        controller.stepTrendLines(bars, state.trendLines, 40, 200, true, true);
        pendingCounts.push(state.trendLines.pendingTrendLines.length);
        confirmedCounts.push(state.trendLines.confirmedTrendLines.length);
      },
    };

    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, new RecordingBacktester());
    await lifecycle.initialize(Array.from({ length: 11 }, (_, index) => createBar(index * 60_000, 10)));

    for (const price of prices) await lifecycle.processTick(price);

    expect(pendingCounts.at(-1)).toBe(remaining);
    expect(confirmedCounts).toEqual(prices.map(() => 0));
    expect(candidateSlopes).toEqual(incomingSlopes);

    jest.spyOn(Date, 'now').mockReturnValue(720_000);
    lifecycle.finalizeBar();
    await lifecycle.processTick(9);
    await lifecycle.processTick(9);

    expect(pendingCounts.slice(-2)).toEqual([remaining, remaining]);
    expect(confirmedCounts.slice(-2)).toEqual([0, 0]);

    jest.spyOn(Date, 'now').mockReturnValue(780_000);
    lifecycle.finalizeBar();
    await lifecycle.processTick(9);
    await lifecycle.processTick(9);

    expect(pendingCounts.slice(-2)).toEqual([0, 0]);
    expect(confirmedCounts.slice(-2)).toEqual([remaining, remaining]);
  });

  it('keeps an expired trend line removed between active ticks', async () => {
    const strategy = new ExpiringTrendLineStrategy();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, new RecordingBacktester());
    await lifecycle.initialize([createBar(0, 10)]);

    await lifecycle.processTick(10);
    await lifecycle.processTick(10);

    expect(strategy.incomingConfirmedCounts).toEqual([1, 0]);
    expect(strategy.incomingChartCounts).toEqual([1, 0]);
  });

  it('carries strategy state until completion and continues backtester ticks until the bar closes', async () => {
    const strategy = new FreezingStrategy();
    const backtester = new RecordingBacktester();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, backtester);
    await lifecycle.initialize([createBar(0, 10)]);

    await lifecycle.processTick(12);
    const frozen: Bar = await lifecycle.processTick(13);
    const strategyCallsAtFreeze: number = strategy.calls;
    const backtesterCallsAtFreeze: number = backtester.calls.length;
    const continued: Bar = await lifecycle.processTick(14);

    expect(continued).toBe(frozen);
    expect(continued.prices.close).toBe(14);
    expect(continued.indicators?.ema?.[1]).toBe(13);
    expect(continued.backtest.signals[0].price).toBe(13);
    expect(strategy.calls).toBe(strategyCallsAtFreeze);
    expect(strategy.incomingMarkers).toEqual([0, 12]);
    expect(backtester.calls).toHaveLength(backtesterCallsAtFreeze + 1);

    jest.spyOn(Date, 'now').mockReturnValue(120_000);
    const finalized: Bar | undefined = lifecycle.finalizeBar();

    expect(strategy.calls).toBe(strategyCallsAtFreeze);
    expect(backtester.calls).toHaveLength(backtesterCallsAtFreeze + 1);
    expect(finalized).toBe(continued);
    expect(continued.times).toEqual({ open: 60_000 });
    expect(continued.prices).toEqual({ open: 12, high: 14, low: 12, close: 14 });
    expect(continued.volume).toBe(0);

    const next: Bar = await lifecycle.processTick(20);
    expect(next.times.open).toBe(120_000);
    expect(strategy.incomingBarDone.at(-1)).toBe(false);
    expect(strategy.incomingMarkers.at(-1)).toBe(13);
    expect(backtester.calls.at(-1)?.incomingProfit).toBe(49);

    await lifecycle.processTick(21);
    expect(strategy.incomingMarkers).toEqual([0, 12, 13, 20]);
  });

  it('records tick OHLC only when finalizing and starts a fresh range for the next bar', async () => {
    const strategy = new FreezingStrategy();
    const backtester = new RecordingBacktester();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, backtester);
    await lifecycle.initialize([createBar(0, 10)]);
    const observedPrices: number[] = [11, 16, 8, 12];
    const tickBars: Bar[] = [];

    for (const price of observedPrices) {
      const tick: Bar = await lifecycle.processTick(price);
      expect(tick.prices).toEqual({ open: price, high: price, low: price, close: price });
      tickBars.push(tick);
    }

    const callsBeforeRefresh: number = backtester.calls.length;
    const strategyCalls: number = strategy.calls;
    const now = jest.spyOn(Date, 'now').mockReturnValue(119_999);
    expect(lifecycle.finalizeBar()).toBeUndefined();
    expect(tickBars.at(-1)?.prices).toEqual({ open: 12, high: 12, low: 12, close: 12 });
    expect(backtester.calls).toHaveLength(callsBeforeRefresh);

    now.mockReturnValue(120_000);
    const finalized: Bar = lifecycle.finalizeBar()!;
    expect(finalized).toBe(tickBars.at(-1));
    expect(finalized.prices).toEqual({ open: 11, high: 16, low: 8, close: 12 });
    expect(tickBars.every((tick) => tick === finalized)).toBe(true);
    expect(backtester.calls).toHaveLength(callsBeforeRefresh);
    expect(strategy.calls).toBe(strategyCalls);
    expect(lifecycle.finalizeBar()).toBeUndefined();

    expect((await lifecycle.processTick(40)).times.open).toBe(120_000);
    expect(strategy.incomingMarkers.at(-1)).toBe(12);
    expect(strategy.incomingBarDone.at(-1)).toBe(false);
    now.mockReturnValue(180_000);
    expect(lifecycle.finalizeBar()?.prices).toEqual({ open: 40, high: 40, low: 40, close: 40 });
  });

  it.each([11, 13])('finalizes a single tick at price %s without replaying either engine', async (price) => {
    const strategy = new FreezingStrategy();
    const backtester = new RecordingBacktester();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, backtester);
    await lifecycle.initialize([createBar(0, 10)]);
    const active: Bar = await lifecycle.processTick(price);
    const strategyCalls: number = strategy.calls;
    const backtesterCalls: number = backtester.calls.length;
    const now = jest.spyOn(Date, 'now').mockReturnValue(120_000);
    expect(lifecycle.finalizeBar()).toBe(active);
    expect(strategy.calls).toBe(strategyCalls);
    expect(backtester.calls).toHaveLength(backtesterCalls);
    expect(active.times).toEqual({ open: 60_000 });
    expect(active.prices).toEqual({ open: price, high: price, low: price, close: price });
    expect(active.backtest.profit).toBe(10 + price);
    expect(active.backtest.signals).toHaveLength(price === 13 ? 1 : 0);

    now.mockReturnValue(180_000);
    expect(lifecycle.finalizeBar()).toBeUndefined();
  });

  it('finalizes only an observed bar after its timeframe has physically closed', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new DuplicateBuyStrategy(), new RecordingBacktester());
    await lifecycle.initialize([createBar(0, 10)]);
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(119_999);
    expect(lifecycle.isActiveBarClosed()).toBe(false);
    now.mockReturnValue(120_000);
    expect(lifecycle.isActiveBarClosed()).toBe(false);
    expect(lifecycle.finalizeBar()).toBeUndefined();
    await lifecycle.processTick(11);
    now.mockReturnValue(119_999);
    expect(lifecycle.isActiveBarClosed()).toBe(false);
    now.mockReturnValue(120_000);
    expect(lifecycle.isActiveBarClosed()).toBe(true);
    expect(lifecycle.finalizeBar()).toBeDefined();
  });
});
