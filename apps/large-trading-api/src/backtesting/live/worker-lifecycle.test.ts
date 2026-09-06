import { describe, expect, it, jest } from '@jest/globals';
import {
  BacktesterCall,
  BacktesterState,
  Bar,
  Exchange,
  LinearFunction,
  LiveBacktesterInstance,
  LiveStrategyInstance,
  LiveStrategyState,
  Signal,
  Slope,
  Timeframe,
  TrendLine,
  TrendLinePosition,
  createSignal,
} from '@shared';
import Backtester from '../backtester/backtester';
import MeanReversion from '../../strategies/mean-reversion';
import TrendLineController from '../../patterns/trend-line';
import LiveWorkerLifecycle from './worker-lifecycle';

class RecordingBacktester implements LiveBacktesterInstance {
  public readonly calls: BacktesterCall[] = [];

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

class CumulativeStrategy implements LiveStrategyInstance {
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

class FreezingStrategy implements LiveStrategyInstance {
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

class DuplicateBuyStrategy implements LiveStrategyInstance {
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

class TrailingEntryStrategy implements LiveStrategyInstance {
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

class StopLossStrategy implements LiveStrategyInstance {
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

class BarReferenceStrategy implements LiveStrategyInstance {
  public referencesMatched = false;

  public stepSetSignals(bars: Bar[], state: LiveStrategyState): void {
    if (bars.length === 1) {
      state.reference = bars[0];
      return;
    }

    this.referencesMatched = state.reference === bars[0];
    state.reference.chart = { marketStructure: { streak: bars.length, direction: 'UP' } };
  }
}

class RetainedBreakthroughStrategy implements LiveStrategyInstance {
  private readonly controller = new TrendLineController();
  public readonly incomingConfirmedCounts: number[] = [];
  public readonly incomingOriginBreakThroughIndexes: (number | undefined)[] = [];
  public readonly newBreakthroughCounts: number[] = [];

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

class AccumulatingConfirmedTrendLineStrategy implements LiveStrategyInstance {
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

class ExpiringTrendLineStrategy implements LiveStrategyInstance {
  private readonly controller = new TrendLineController();
  public readonly incomingConfirmedCounts: number[] = [];
  public readonly incomingChartCounts: number[] = [];

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
    times: { open: openTime, close: openTime + 59_999 },
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

function createLifecycle(
  strategyInstance: LiveStrategyInstance,
  backtester: LiveBacktesterInstance,
  strategyConfig: any = {},
): LiveWorkerLifecycle {
  return new LiveWorkerLifecycle({
    strategyInstance,
    backtester,
    strategyConfig,
    timeframeMs: 60_000,
    commission: 0,
  });
}

describe('live worker lifecycle', () => {
  it('retains cumulative discoveries while replacing each tick price and deduplicating signals', async () => {
    const strategy = new CumulativeStrategy();
    const backtester = new RecordingBacktester();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, backtester);
    await lifecycle.initialize([createBar(0, 10)]);

    const first: Bar = await lifecycle.processTick(11);

    first.backtest.signals.push(
      createSignal({
        uniqueIdentifier: 'backtester-close',
        signal: Signal.StopLoss,
        price: 9,
      }),
    );

    const second: Bar = await lifecycle.processTick(12);

    expect(first.prices).toEqual({ open: 11, high: 11, low: 11, close: 11 });
    expect(second.prices).toEqual({ open: 12, high: 12, low: 12, close: 12 });
    expect(second.times.open).toBe(60_000);
    expect(second.candlestickPatterns).toEqual({ hammer: true, doji: true });
    expect(second.indicators?.rsiDivergence?.regular).toBe(2);
    expect(second.indicators?.rsiDivergence?.originTrendLines).toHaveLength(2);
    expect(second.chart?.trendLineBreakthroughs).toHaveLength(2);
    expect(second.backtest.signals.map((signal) => signal.uniqueIdentifier)).toEqual(['"one-entry"', '"backtester-close"']);
    expect(second.backtest.signals[0].price).toBe(11);
    expect(backtester.calls.at(-1)?.signalIdentifiers).toEqual(['"one-entry"', '"backtester-close"']);
    expect(lifecycle.getLastCommittedBar().times.open).toBe(0);
  });

  it('deduplicates retained strategy signals before the real backtester opens positions', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new DuplicateBuyStrategy(), new Backtester());
    await lifecycle.initialize([createBar(0, 100)]);

    await lifecycle.processTick(101);
    const second: Bar = await lifecycle.processTick(102);

    expect(second.backtest.signals).toHaveLength(1);
    expect(second.backtest.signals[0].price).toBe(101);
    expect(second.backtest.openPositionSize).toBeCloseTo(102 / 101);
  });

  it('carries a position across ticks and never reopens its retained entry after it closes', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new TrailingEntryStrategy(), new Backtester());
    await lifecycle.initialize([createBar(0, 100)]);

    const opened: Bar = await lifecycle.processTick(110);
    const trailed: Bar = await lifecycle.processTick(130);
    const stopped: Bar = await lifecycle.processTick(100);
    const rebounded: Bar = await lifecycle.processTick(120);

    expect(opened.backtest.openPositionSize).toBe(1);
    expect(trailed.backtest.openPositionSize).toBeCloseTo(1.181818);
    expect(stopped.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.Buy, Signal.StopLoss]);
    expect(stopped.backtest.openPositionSize).toBe(0);
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
    const continued: Bar = await lifecycle.processTick(95);

    expect(completed.backtest.signals.map((signal) => signal.signal)).toContain(Signal.Buy);
    expect(completed.backtest.signals.find((signal) => signal.signal === Signal.Buy)?.uniqueIdentifier).toBeUndefined();
    expect(completed.backtest.openPositionSize).toBe(1);
    expect(continued).not.toBe(completed);
    expect(continued.prices.close).toBe(95);
    expect(continued.backtest.signals.find((signal) => signal.signal === Signal.Buy)?.price).toBe(70);
    expect(continued.backtest.openPositionSize).toBeCloseTo(95 / 70);
    expect(stepSetSignals).toHaveBeenCalledTimes(strategyCallsAtCompletion);
  });

  it('keeps a retained stop-loss applied after a later tick moves away from its trigger', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new StopLossStrategy(), new Backtester());
    await lifecycle.initialize([createBar(0, 100)]);

    const triggered: Bar = await lifecycle.processTick(89);
    const rebounded: Bar = await lifecycle.processTick(100);

    expect(triggered.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.StopLoss]);
    expect(triggered.backtest.signals[0].uniqueIdentifier).toBeDefined();
    expect(triggered.backtest.openPositionSize).toBe(0);
    expect(rebounded.backtest.signals.map((signal) => signal.signal)).toEqual([Signal.StopLoss]);
    expect(rebounded.backtest.signals[0].uniqueIdentifier).toBe(triggered.backtest.signals[0].uniqueIdentifier);
    expect(rebounded.backtest.openPositionSize).toBe(0);
  });

  it('keeps strategy state bar references attached to the retained calculation window', async () => {
    const strategy = new BarReferenceStrategy();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, new RecordingBacktester());
    await lifecycle.initialize([createBar(0, 10)]);

    await lifecycle.processTick(11);
    await lifecycle.refreshWindow([createBar(60_000, 12)]);

    expect(strategy.referencesMatched).toBe(true);
    expect(lifecycle.getLastCommittedBar().times.open).toBe(60_000);
  });

  it('keeps a retained trend-line breakthrough retired after a later tick rebounds', async () => {
    const strategy = new RetainedBreakthroughStrategy();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, new RecordingBacktester());
    await lifecycle.initialize([createBar(0, 10)]);

    const crossed: Bar = await lifecycle.processTick(11);
    const rebounded: Bar = await lifecycle.processTick(9);

    expect(crossed.chart?.trendLineBreakthroughs).toHaveLength(1);
    expect(rebounded.chart?.trendLineBreakthroughs).toHaveLength(1);

    await lifecycle.refreshWindow([createBar(60_000, 9)]);
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
    { prices: [11, 9], remaining: 0 },
    { prices: [9, 11, 9], remaining: 0 },
    { prices: [9, 9], remaining: 1 },
  ])('preserves pending-line transitions across ticks $prices', async ({ prices, remaining }) => {
    const controller = new TrendLineController();
    const pendingCounts: number[] = [];
    const confirmedCounts: number[] = [];
    const candidateSlopes: number[] = [];

    const strategy: LiveStrategyInstance = {
      stepSetSignals(bars, state): void {
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
    expect(candidateSlopes).toEqual(prices.map(() => Infinity));

    await lifecycle.refreshWindow([createBar(660_000, 9)]);
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

  it('freezes strategy state at completion while continuing backtester ticks until commit', async () => {
    const strategy = new FreezingStrategy();
    const backtester = new RecordingBacktester();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, backtester);
    await lifecycle.initialize([createBar(0, 10)]);

    await lifecycle.processTick(12);
    const frozen: Bar = await lifecycle.processTick(13);
    const strategyCallsAtFreeze: number = strategy.calls;
    const backtesterCallsAtFreeze: number = backtester.calls.length;
    const continued: Bar = await lifecycle.processTick(14);

    expect(continued).not.toBe(frozen);
    expect(continued.prices.close).toBe(14);
    expect(continued.indicators?.ema?.[1]).toBe(13);
    expect(continued.backtest.signals[0].price).toBe(13);
    expect(strategy.calls).toBe(strategyCallsAtFreeze);
    expect(backtester.calls).toHaveLength(backtesterCallsAtFreeze + 1);

    const historical: Bar = createBar(60_000, 99);
    historical.times.close = 119_999;
    historical.prices = { open: 90, high: 105, low: 80, close: 99 };
    historical.volume = 999;
    const [finalized]: Bar[] = await lifecycle.refreshWindow([historical]);

    expect(strategy.calls).toBe(strategyCallsAtFreeze);
    expect(backtester.calls).toHaveLength(backtesterCallsAtFreeze + 1);
    expect(finalized).toBe(continued);
    expect(lifecycle.getLastCommittedBar()).toBe(continued);
    expect(continued.times).toEqual(historical.times);
    expect(continued.prices).toEqual(historical.prices);
    expect(continued.volume).toBe(0);

    const next: Bar = await lifecycle.processTick(20);
    expect(next.times.open).toBe(120_000);
    expect(strategy.incomingBarDone.at(-1)).toBe(false);
    expect(strategy.incomingMarkers.at(-1)).toBe(13);
    expect(backtester.calls.at(-1)?.incomingProfit).toBe(49);
  });

  it('waits on empty or stale history, then processes only later missed bars normally', async () => {
    const strategy = new FreezingStrategy();
    const backtester = new RecordingBacktester();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, backtester);
    await lifecycle.initialize([createBar(0, 10)]);
    const active: Bar = await lifecycle.processTick(11);
    const callsBeforeRefresh: number = backtester.calls.length;

    expect(await lifecycle.refreshWindow([])).toEqual([]);
    expect(await lifecycle.refreshWindow([createBar(0, 10)])).toEqual([]);
    expect(lifecycle.getLastCommittedBar().times.open).toBe(0);
    expect(backtester.calls).toHaveLength(callsBeforeRefresh);

    const refreshed: Bar[] = await lifecycle.refreshWindow([createBar(60_000, 20), createBar(120_000, 30)]);

    expect(refreshed.map((bar) => bar.times.open)).toEqual([60_000, 120_000]);
    expect(refreshed[0]).toBe(active);
    expect(lifecycle.getLastCommittedBar().times.open).toBe(120_000);
    expect(backtester.calls).toHaveLength(callsBeforeRefresh + 1);
    expect(backtester.calls.at(-1)?.openTime).toBe(120_000);
    expect(strategy.incomingMarkers.at(-1)).toBe(11);
    expect((await lifecycle.processTick(40)).times.open).toBe(180_000);
    expect(strategy.incomingMarkers.at(-1)).toBe(30);
    expect(strategy.incomingBarDone.at(-1)).toBe(false);
  });

  it.each([11, 13])('waits for matching history while retaining the tick at price %s', async (price) => {
    const strategy = new FreezingStrategy();
    const backtester = new RecordingBacktester();
    const lifecycle: LiveWorkerLifecycle = createLifecycle(strategy, backtester);
    await lifecycle.initialize([createBar(0, 10)]);
    const active: Bar = await lifecycle.processTick(price);
    const strategyCalls: number = strategy.calls;
    const backtesterCalls: number = backtester.calls.length;
    const laterBar: Bar = createBar(120_000, 30);

    expect(await lifecycle.refreshWindow([laterBar])).toEqual([]);
    expect(lifecycle.getLastCommittedBar().times.open).toBe(0);
    expect(strategy.calls).toBe(strategyCalls);
    expect(backtester.calls).toHaveLength(backtesterCalls);
    expect(active.times).toEqual({ open: 60_000 });
    expect(active.prices).toEqual({ open: price, high: price, low: price, close: price });
    expect(active.backtest.profit).toBe(10 + price);
    expect(active.backtest.signals).toHaveLength(price === 13 ? 1 : 0);

    const historicalBar: Bar = createBar(60_000, 20);
    const refreshed: Bar[] = await lifecycle.refreshWindow([historicalBar, laterBar]);

    expect(refreshed.map((bar) => bar.times.open)).toEqual([60_000, 120_000]);
    expect(refreshed[0]).toBe(active);
    expect(active.times).toEqual(historicalBar.times);
    expect(active.prices).toEqual(historicalBar.prices);
    expect(strategy.calls).toBe(strategyCalls + 1);
    expect(strategy.incomingMarkers.at(-1)).toBe(price);
    expect(strategy.incomingBarDone.at(-1)).toBe(false);
    expect(backtester.calls).toHaveLength(backtesterCalls + 1);
    expect(backtester.calls.at(-1)?.incomingProfit).toBe(10 + price);
    expect(lifecycle.getLastCommittedBar()).toBe(laterBar);
  });

  it('refreshes only after the active timeframe has physically closed', async () => {
    const lifecycle: LiveWorkerLifecycle = createLifecycle(new DuplicateBuyStrategy(), new RecordingBacktester());
    await lifecycle.initialize([createBar(0, 10)]);
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(119_999);
    expect(lifecycle.shouldRefresh()).toBe(false);
    now.mockReturnValue(120_000);
    expect(lifecycle.shouldRefresh()).toBe(true);
    await lifecycle.processTick(11);
    now.mockReturnValue(119_999);
    expect(lifecycle.shouldRefresh()).toBe(false);
    now.mockReturnValue(120_000);
    expect(lifecycle.shouldRefresh()).toBe(true);
    now.mockRestore();
  });
});
