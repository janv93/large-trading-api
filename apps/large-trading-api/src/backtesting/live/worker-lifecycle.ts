import {
  BacktesterState,
  BacktestSignal,
  Bar,
  BarPrices,
  clone,
  LiveCalculationState,
  LiveStrategyState,
  LiveWorkerLifecycleOptions,
  TrendLine,
} from '@shared';

export default class LiveWorkerLifecycle {
  private committedState: LiveCalculationState = {
    window: [],
    strategyState: {},
    backtesterState: {},
  };

  private activeState?: LiveCalculationState;
  private activePrices?: BarPrices;

  public constructor(private readonly options: LiveWorkerLifecycleOptions) {}

  public async initialize(bars: Bar[]): Promise<void> {
    for (const bar of bars) await this.stepHistoricalBar(bar);
  }

  public getLastCommittedBar(): Bar {
    return this.committedState.window.at(-1)!;
  }

  public isActiveBarClosed(): boolean {
    const activeBar: Bar | undefined = this.activeState?.window.at(-1);
    return activeBar !== undefined && Date.now() >= activeBar.times.open + this.options.timeframeMs;
  }

  public finalizeBar(): Bar | undefined {
    if (!this.isActiveBarClosed()) return;
    return this.commitActiveBar();
  }

  public async processTick(price: number): Promise<Bar> {
    const activeState: LiveCalculationState | undefined = this.activeState;
    const [window, strategyState] = await this.calculateStrategyTick(price, activeState);
    const backtesterState: BacktesterState = this.calculateBacktesterTick(window, activeState);
    const bar: Bar = window.at(-1)!;
    this.setOhlc(price);
    this.activeState = { window, strategyState, backtesterState };
    return bar;
  }

  private async calculateStrategyTick(price: number, activeState: LiveCalculationState | undefined): Promise<[Bar[], LiveStrategyState]> {
    if (activeState?.strategyState.barDone === true) {
      const snapshot = clone({
        window: activeState.window,
        strategyState: activeState.strategyState,
      });
      const bar: Bar = snapshot.window.at(-1)!;
      bar.prices = { open: price, high: price, low: price, close: price };

      return [snapshot.window, snapshot.strategyState];
    }

    const snapshot = clone({
      window: this.committedState.window,
      strategyState: this.committedState.strategyState,
      previousBar: activeState?.window.at(-1),
      retainedConfirmedTrendLines: activeState?.strategyState.trendLines?.confirmedTrendLines,
      retainedPendingTrendLines: activeState?.strategyState.trendLines?.pendingTrendLines,
      retainedTrendLineCharts: activeState?.window.slice(0, -1).map((bar) => bar.chart?.trendLines),
    });
    this.restoreRetainedTrendLines(
      snapshot.window,
      snapshot.strategyState,
      snapshot.retainedConfirmedTrendLines,
      snapshot.retainedPendingTrendLines,
      snapshot.retainedTrendLineCharts,
    );
    const bar: Bar = this.createTickBar(price, snapshot.window.at(-1)!, snapshot.previousBar);
    const window: Bar[] = [...snapshot.window, bar];

    await this.options.strategyInstance.stepSetSignals(window, snapshot.strategyState, this.options.strategyConfig);
    if (snapshot.strategyState.barDone !== true) this.deduplicateSignals(bar);

    return [window, snapshot.strategyState];
  }

  private calculateBacktesterTick(window: Bar[], activeState: LiveCalculationState | undefined): BacktesterState {
    const backtesterState: BacktesterState = clone(activeState?.backtesterState ?? this.committedState.backtesterState);
    backtesterState.volatility = this.committedState.backtesterState.volatility;
    this.options.backtesterInstance.stepCalcBacktestPerformance(window, backtesterState, this.options.commission);
    return backtesterState;
  }

  private setOhlc(price: number): void {
    this.activePrices = {
      open: this.activePrices?.open ?? price,
      high: Math.max(this.activePrices?.high ?? price, price),
      low: Math.min(this.activePrices?.low ?? price, price),
      close: price,
    };
  }

  private async stepHistoricalBar(bar: Bar): Promise<void> {
    const { window, strategyState, backtesterState } = this.committedState;
    window.push(bar);
    await this.options.strategyInstance.stepSetSignals(window, strategyState, this.options.strategyConfig);
    strategyState.barDone = false;
    this.options.backtesterInstance.stepCalcBacktestPerformance(window, backtesterState, this.options.commission);
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
    const activeState: LiveCalculationState = this.activeState!;
    const activeBar: Bar = activeState.window.at(-1)!;
    activeBar.prices = this.activePrices!;
    this.committedState = activeState;
    this.committedState.strategyState.barDone = false;
    this.activeState = undefined;
    this.activePrices = undefined;
    return activeBar;
  }
}
