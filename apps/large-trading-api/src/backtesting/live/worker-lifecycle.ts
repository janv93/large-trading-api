import { BacktesterState, BacktestSignal, Bar, BarPrices, clone, LiveStrategyState, LiveWorkerLifecycleOptions, TrendLine } from '@shared';

export default class LiveWorkerLifecycle {
  private bars: Bar[] = [];
  private strategyState: LiveStrategyState = {};
  private readonly backtesterState: BacktesterState = {};
  private strategyInput = { bars: this.bars, state: this.strategyState };
  private barPrices?: BarPrices;
  private barVolatility?: number;

  public constructor(private readonly options: LiveWorkerLifecycleOptions) {}

  public async initialize(bars: Bar[]): Promise<void> {
    for (const bar of bars) {
      this.bars.push(bar);
      await this.options.strategyInstance.stepSetSignals(this.bars, this.strategyState, this.options.strategyConfig);
      this.strategyState.barDone = false;
      this.options.backtesterInstance.stepCalcBacktestPerformance(this.bars, this.backtesterState, this.options.commission);
    }
  }

  public isActiveBarClosed(): boolean {
    return this.barPrices !== undefined && Date.now() >= this.bars.at(-1)!.times.open + this.options.timeframeMs;
  }

  public finalizeBar(): Bar | undefined {
    if (!this.isActiveBarClosed()) return;
    const lastBar: Bar = this.bars.at(-1)!;
    lastBar.prices = this.barPrices!;
    this.strategyState.barDone = false;
    this.barPrices = undefined;
    return lastBar;
  }

  public async processTick(price: number): Promise<Bar> {
    if (!this.barPrices) {
      this.strategyInput = { bars: this.bars, state: this.strategyState };
      this.barVolatility = this.backtesterState.volatility;
    }

    const prices: BarPrices = { open: price, high: price, low: price, close: price };

    if (this.strategyState.barDone === true) {
      this.bars.at(-1)!.prices = prices;
    } else {
      await this.evaluateStrategy(prices);
    }

    const bar: Bar = this.bars.at(-1)!;
    this.backtesterState.volatility = this.barVolatility;
    this.options.backtesterInstance.stepCalcBacktestPerformance(this.bars, this.backtesterState, this.options.commission);

    this.barPrices = {
      open: this.barPrices?.open ?? price,
      high: Math.max(this.barPrices?.high ?? price, price),
      low: Math.min(this.barPrices?.low ?? price, price),
      close: price,
    };

    return bar;
  }

  private async evaluateStrategy(prices: BarPrices): Promise<void> {
    const previousBar: Bar = this.strategyInput.bars.at(-1)!;
    const previousTick: Bar | undefined = this.barPrices ? this.bars.at(-1) : undefined;

    const bar: Bar = {
      symbol: previousBar.symbol,
      exchange: previousBar.exchange,
      ...(previousBar.feed ? { feed: previousBar.feed } : {}),
      timeframe: previousBar.timeframe,
      times: { open: previousBar.times.open + this.options.timeframeMs },
      prices,
      volume: 0,
      candlestickPatterns: previousTick?.candlestickPatterns,
      indicators: previousTick?.indicators?.rsiDivergence ? { rsiDivergence: previousTick.indicators.rsiDivergence } : undefined,
      chart: previousTick?.chart?.trendLineBreakthroughs
        ? { trendLineBreakthroughs: previousTick.chart.trendLineBreakthroughs }
        : undefined,
      backtest: { signals: previousTick?.backtest.signals ?? [] },
    };

    const input = clone({ ...this.strategyInput, bar });
    input.bars.push(input.bar);
    await this.options.strategyInstance.stepSetSignals(input.bars, input.state, this.options.strategyConfig);
    input.bar.backtest.signals = this.deduplicateSignals(input.bar.backtest.signals);
    this.bars = input.bars;
    this.strategyState = input.state;
    this.retainTrendLines();
  }

  private retainTrendLines(): void {
    if (!this.strategyState.trendLines && !this.strategyInput.state.trendLines) return;

    if (this.strategyState.trendLines?.confirmedTrendLines !== undefined) {
      this.strategyInput.state.trendLines ??= {};
      this.strategyInput.state.trendLines.confirmedTrendLines = this.strategyState.trendLines.confirmedTrendLines;
    }

    if (this.strategyInput.state.trendLines?.pendingTrendLines && this.strategyState.trendLines?.pendingTrendLines !== undefined) {
      this.strategyInput.state.trendLines.pendingTrendLines = this.strategyInput.state.trendLines.pendingTrendLines.filter(
        (trendLine: TrendLine) =>
          this.strategyState.trendLines.pendingTrendLines.some(
            (retained: TrendLine) =>
              retained.startIndex === trendLine.startIndex &&
              retained.endIndex === trendLine.endIndex &&
              retained.position === trendLine.position,
          ),
      );
    }

    this.strategyInput.bars.forEach((bar, index) => {
      if (this.bars[index].chart?.trendLines !== undefined) {
        bar.chart ??= {};
        bar.chart.trendLines = this.bars[index].chart!.trendLines;
      } else if (bar.chart) {
        delete bar.chart.trendLines;
      }
    });
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
