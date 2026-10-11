import { BacktestSignal, Bar, Direction, MarketStructureStats, Signal } from '@shared';
import Base from '../base';
import PivotPointController from '../patterns/pivot-point';

export default class MarketStructure extends Base {
  private pivotPointController = new PivotPointController();

  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const space: number = Number(params.space);
    state.marketStructure ??= {};
    this.pivotPointController.stepMarketStructure(bars, state.marketStructure, space);

    const bar: Bar = bars[bars.length - 1];
    const currentMarketStructureStats: MarketStructureStats | undefined = bar.chart?.marketStructure;
    const marketStructureOneAgo: MarketStructureStats | undefined = bars.at(-2)?.chart?.marketStructure;
    if (!currentMarketStructureStats || !marketStructureOneAgo) return;

    if (currentMarketStructureStats.streak === 1 && marketStructureOneAgo.streak > 4) {
      const signals: BacktestSignal[] = bar.backtest.signals;
      const closePrice: number = bar.prices.close;

      if (currentMarketStructureStats.direction === Direction.Up) {
        signals.push({ signal: Signal.Buy, size: marketStructureOneAgo.streak, price: closePrice });
        state.barDone = true;
      } else if (currentMarketStructureStats.direction === Direction.Down) {
        signals.push({ signal: Signal.Sell, size: marketStructureOneAgo.streak, price: closePrice });
        state.barDone = true;
      }
    }
  }
}
