import { BacktesterState, BacktestSignal, Bar, BarPrices, LiveStrategyState, LiveWorkerLifecycleOptions } from '@shared';

export default class LiveWorkerLifecycle {
  private readonly bars: Bar[] = [];
  private readonly strategyState: LiveStrategyState = {};
  private observedPrices?: BarPrices;
  private readonly backtesterState: BacktesterState = {};

  public constructor(private readonly options: LiveWorkerLifecycleOptions) {}

  public async initialize(bars: Bar[]): Promise<void> {
    for (const bar of bars) {
      this.bars.push(bar);
      await this.runStrategy();
      this.strategyState.barDone = false;
      this.runBacktester();
    }
  }

  public isActiveBarClosed(): boolean {
    if (!this.observedPrices) return false;
    return Date.now() >= this.bars.at(-1)!.times.open + this.options.timeframeMs;
  }

  public finalizeBar(): Bar | undefined {
    if (!this.observedPrices || !this.isActiveBarClosed()) return;
    this.bars.at(-1)!.prices = this.observedPrices;
    this.strategyState.barDone = false;
    this.observedPrices = undefined;
    return this.bars.at(-1)!;
  }

  public async processTick(price: number): Promise<Bar> {
    const prices: BarPrices = { open: price, high: price, low: price, close: price };

    if (!this.observedPrices) {
      this.bars.push(this.createBar(prices));
      this.observedPrices = prices;
    } else {
      this.bars.at(-1)!.prices = prices;
    }

    if (!this.strategyState.barDone) {
      await this.runStrategy();
      this.bars.at(-1)!.backtest.signals = this.deduplicateSignals(this.bars.at(-1)!.backtest.signals);
    }

    this.runBacktester();
    this.updateObservedPrices(price);

    return this.bars.at(-1)!;
  }

  private updateObservedPrices(price: number): void {
    this.observedPrices!.high = Math.max(this.observedPrices!.high, price);
    this.observedPrices!.low = Math.min(this.observedPrices!.low, price);
    this.observedPrices!.close = price;
  }

  private createBar(prices: BarPrices): Bar {
    const lastCompletedBar: Bar = this.bars.at(-1)!;

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

  private async runStrategy(): Promise<void> {
    await this.options.strategyInstance.stepSetSignals(this.bars, this.strategyState, this.options.strategyConfig);
  }

  private runBacktester(): void {
    this.options.backtesterInstance.stepCalcBacktestPerformance(this.bars, this.backtesterState, this.options.commission);
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
