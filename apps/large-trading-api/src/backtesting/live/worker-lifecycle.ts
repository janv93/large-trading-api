import {
  CalculationState,
  BacktesterState,
  BacktestSignal,
  Bar,
  LiveStrategyState,
  LiveWorkerLifecycleOptions,
  TrendLine,
  clone,
} from '@shared';

export default class LiveWorkerLifecycle {
  private committedState: CalculationState = {
    window: [],
    strategyState: {},
    backtesterState: {},
  };

  private activeSnapshot?: CalculationState;
  private activePrices?: Bar['prices'];

  public constructor(private readonly options: LiveWorkerLifecycleOptions) {}

  public async initialize(bars: Bar[]): Promise<void> {
    for (const bar of bars) await this.stepHistoricalBar(bar);
  }

  public getLastCommittedBar(): Bar {
    return this.committedState.window.at(-1)!;
  }

  public isActiveBarClosed(now: number = Date.now()): boolean {
    const activeBar: Bar | undefined = this.activeSnapshot?.window.at(-1);
    return activeBar !== undefined && now >= activeBar.times.open + this.options.timeframeMs;
  }

  public finalizeBar(now: number = Date.now()): Bar | undefined {
    if (!this.isActiveBarClosed(now)) return;
    return this.commitActiveBar();
  }

  public async processTick(price: number): Promise<Bar> {
    const activeSnapshot: CalculationState | undefined = this.activeSnapshot;
    let calculationWindow: Bar[];
    let strategyState: LiveStrategyState;
    let bar: Bar;

    if (activeSnapshot?.strategyState.barDone === true) {
      const snapshot = clone({
        window: activeSnapshot.window,
        strategyState: activeSnapshot.strategyState,
      });

      calculationWindow = snapshot.window;
      strategyState = snapshot.strategyState;
      bar = this.updateBacktesterTickBar(price, calculationWindow.at(-1)!);
    } else {
      const snapshot = clone({
        window: this.committedState.window,
        strategyState: this.committedState.strategyState,
        previousBar: activeSnapshot?.window.at(-1),
        retainedConfirmedTrendLines: activeSnapshot?.strategyState.trendLines?.confirmedTrendLines,
        retainedPendingTrendLines: activeSnapshot?.strategyState.trendLines?.pendingTrendLines,
        retainedTrendLineCharts: activeSnapshot?.window.slice(0, -1).map((bar) => bar.chart?.trendLines),
      });
      this.restoreRetainedTrendLines(
        snapshot.window,
        snapshot.strategyState,
        snapshot.retainedConfirmedTrendLines,
        snapshot.retainedPendingTrendLines,
        snapshot.retainedTrendLineCharts,
      );
      bar = this.createTickBar(price, snapshot.window.at(-1)!, snapshot.previousBar);
      calculationWindow = [...snapshot.window, bar];
      strategyState = snapshot.strategyState;

      await this.options.strategyInstance.stepSetSignals(calculationWindow, strategyState, this.options.strategyConfig);
      if (strategyState.barDone !== true) this.deduplicateSignals(bar);
    }

    const backtesterState: BacktesterState = clone(activeSnapshot?.backtesterState ?? this.committedState.backtesterState);
    // Volatility is recalculated from the last committed value on every tick.
    backtesterState.volatility = this.committedState.backtesterState.volatility;
    this.options.backtester.stepCalcBacktestPerformance(calculationWindow, backtesterState, this.options.commission);

    this.activePrices = {
      open: this.activePrices?.open ?? price,
      high: Math.max(this.activePrices?.high ?? price, price),
      low: Math.min(this.activePrices?.low ?? price, price),
      close: price,
    };

    this.activeSnapshot = {
      window: calculationWindow,
      strategyState,
      backtesterState,
    };

    return bar;
  }

  private async stepHistoricalBar(bar: Bar): Promise<void> {
    const { window, strategyState, backtesterState } = this.committedState;
    window.push(bar);
    await this.options.strategyInstance.stepSetSignals(window, strategyState, this.options.strategyConfig);
    strategyState.barDone = false;
    this.options.backtester.stepCalcBacktestPerformance(window, backtesterState, this.options.commission);
  }

  private createTickBar(price: number, committed: Bar, previous?: Bar): Bar {
    const rsiDivergence = previous?.indicators?.rsiDivergence;
    const trendLineBreakthroughs = previous?.chart?.trendLineBreakthroughs;

    return {
      symbol: committed.symbol,
      exchange: committed.exchange,
      ...(committed.feed ? { feed: committed.feed } : {}),
      timeframe: committed.timeframe,
      times: { open: committed.times.open + this.options.timeframeMs },
      prices: { open: price, high: price, low: price, close: price },
      volume: 0,
      ...(previous?.candlestickPatterns ? { candlestickPatterns: previous.candlestickPatterns } : {}),
      ...(rsiDivergence ? { indicators: { rsiDivergence } } : {}),
      ...(trendLineBreakthroughs ? { chart: { trendLineBreakthroughs } } : {}),
      backtest: { signals: previous?.backtest.signals ?? [] },
    };
  }

  private updateBacktesterTickBar(price: number, frozenBar: Bar): Bar {
    frozenBar.prices = { open: price, high: price, low: price, close: price };
    return frozenBar;
  }

  private restoreRetainedTrendLines(
    window: Bar[],
    strategyState: LiveStrategyState,
    confirmedTrendLines: TrendLine[] | undefined,
    pendingTrendLines: TrendLine[] | undefined,
    trendLineCharts: (TrendLine[] | undefined)[] | undefined,
  ): void {
    if (confirmedTrendLines !== undefined) {
      strategyState.trendLines ??= {};
      strategyState.trendLines.confirmedTrendLines = confirmedTrendLines;
    }

    if (pendingTrendLines !== undefined && strategyState.trendLines?.pendingTrendLines) {
      strategyState.trendLines.pendingTrendLines = strategyState.trendLines.pendingTrendLines.filter((trendLine) =>
        pendingTrendLines.some(
          (retained) =>
            retained.startIndex === trendLine.startIndex &&
            retained.endIndex === trendLine.endIndex &&
            retained.position === trendLine.position,
        ),
      );
    }

    trendLineCharts?.forEach((trendLines, index) => {
      const bar: Bar | undefined = window[index];
      if (!bar) return;

      if (trendLines === undefined) {
        if (bar.chart) delete bar.chart.trendLines;
        return;
      }

      bar.chart ??= {};
      bar.chart.trendLines = trendLines;
    });
  }

  private deduplicateSignals(bar: Bar): void {
    const identifiers = new Set<string>();

    bar.backtest.signals = bar.backtest.signals.filter((signal: BacktestSignal) => {
      if (signal.uniqueIdentifier === undefined) return true;
      if (identifiers.has(signal.uniqueIdentifier)) return false;
      identifiers.add(signal.uniqueIdentifier);
      return true;
    });
  }

  private commitActiveBar(): Bar {
    const activeSnapshot: CalculationState = this.activeSnapshot!;
    const activeBar: Bar = activeSnapshot.window.at(-1)!;
    activeBar.times.close = activeBar.times.open + this.options.timeframeMs - 1;
    activeBar.prices = this.activePrices!;
    this.committedState = activeSnapshot;
    this.committedState.strategyState.barDone = false;
    this.activeSnapshot = undefined;
    this.activePrices = undefined;
    return activeBar;
  }
}
