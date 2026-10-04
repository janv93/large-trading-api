import {
  BacktesterState,
  BacktestSignal,
  Bar,
  BarPrices,
  clone,
  LiveActiveBar,
  LiveStrategyContext,
  LiveWorkerLifecycleOptions,
  TrendLine,
} from '@shared';

export default class LiveWorkerLifecycle {
  private committed: LiveStrategyContext = { bars: [], state: {} }; // bar-start state plus lasting trend-line results; each tick evaluates a fresh copy
  private active?: LiveActiveBar;
  private readonly backtesterState: BacktesterState = {};

  public constructor(private readonly options: LiveWorkerLifecycleOptions) {}

  public async initialize(bars: Bar[]): Promise<void> {
    for (const bar of bars) {
      this.committed.bars.push(bar);
      await this.runStrategy(this.committed);
      this.committed.state.barDone = false;
      this.runBacktester(this.committed.bars);
    }
  }

  public isActiveBarClosed(): boolean {
    if (!this.active) return false;
    return Date.now() >= this.active.latestTick.bars.at(-1)!.times.open + this.options.timeframeMs;
  }

  public finalizeBar(): Bar | undefined {
    if (!this.active || !this.isActiveBarClosed()) return;
    const completedBar: Bar = this.active.latestTick.bars.at(-1)!;
    completedBar.prices = this.active.observedPrices;
    this.committed = this.active.latestTick;
    this.committed.state.barDone = false;
    this.active = undefined;
    return completedBar;
  }

  public async processTick(price: number): Promise<Bar> {
    const prices: BarPrices = { open: price, high: price, low: price, close: price };
    const latestTick: LiveStrategyContext = await this.evaluateTick(prices);
    this.runBacktester(latestTick.bars);

    const observed: BarPrices = this.active?.observedPrices ?? prices;

    this.active = {
      latestTick,
      observedPrices: { open: observed.open, high: Math.max(observed.high, price), low: Math.min(observed.low, price), close: price },
    };

    return latestTick.bars.at(-1)!;
  }

  private async evaluateTick(prices: BarPrices): Promise<LiveStrategyContext> {
    if (this.active?.latestTick.state.barDone) {
      this.active.latestTick.bars.at(-1)!.prices = prices;
      return this.active.latestTick;
    }

    const tick: LiveStrategyContext = clone({
      bars: [...this.committed.bars, this.active?.latestTick.bars.at(-1) ?? this.createBar(prices)],
      state: this.committed.state,
    });

    tick.bars.at(-1)!.prices = prices;
    await this.runStrategy(tick);
    const activeBar: Bar = tick.bars.at(-1)!;
    activeBar.backtest.signals = this.deduplicateSignals(activeBar.backtest.signals);
    this.retainTrendLines(tick);
    return tick;
  }

  private createBar(prices: BarPrices): Bar {
    const lastCompletedBar: Bar = this.committed.bars.at(-1)!;

    return {
      symbol: lastCompletedBar.symbol,
      exchange: lastCompletedBar.exchange,
      feed: lastCompletedBar.feed,
      timeframe: lastCompletedBar.timeframe,
      times: { open: lastCompletedBar.times.open + this.options.timeframeMs },
      prices,
      volume: 0,
      backtest: { signals: [] },
    };
  }

  /** Keeps this tick's trend-line confirmations, breakthroughs, expiries and pending removals, including their chart drawings, for later ticks of this bar. */
  private retainTrendLines(tick: LiveStrategyContext): void {
    if (!tick.state.trendLines) return;
    this.committed.state.trendLines ??= {};

    if (tick.state.trendLines.confirmedTrendLines) {
      this.committed.state.trendLines.confirmedTrendLines = tick.state.trendLines.confirmedTrendLines;
    }

    if (this.committed.state.trendLines.pendingTrendLines && tick.state.trendLines.pendingTrendLines) {
      this.committed.state.trendLines.pendingTrendLines = this.committed.state.trendLines.pendingTrendLines.filter((pending: TrendLine) =>
        tick.state.trendLines.pendingTrendLines.some(
          (remaining: TrendLine) =>
            remaining.startIndex === pending.startIndex &&
            remaining.endIndex === pending.endIndex &&
            remaining.position === pending.position,
        ),
      );
    }

    this.committed.bars.forEach((bar: Bar, index: number) => {
      const trendLines: TrendLine[] | undefined = tick.bars[index].chart?.trendLines;

      if (trendLines) {
        bar.chart ??= {};
        bar.chart.trendLines = trendLines;
      } else if (bar.chart) {
        delete bar.chart.trendLines;
      }
    });
  }

  private async runStrategy(context: LiveStrategyContext): Promise<void> {
    await this.options.strategyInstance.stepSetSignals(context.bars, context.state, this.options.strategyConfig);
  }

  private runBacktester(bars: Bar[]): void {
    this.options.backtesterInstance.stepCalcBacktestPerformance(bars, this.backtesterState, this.options.commission);
  }

  private deduplicateSignals(signals: BacktestSignal[]): BacktestSignal[] {
    const identifiers = new Set<string>();

    return signals.filter((signal: BacktestSignal) => {
      if (signal.uniqueIdentifier === undefined) return true;
      if (identifiers.has(signal.uniqueIdentifier)) return false;
      identifiers.add(signal.uniqueIdentifier);
      return true;
    });
  }
}
