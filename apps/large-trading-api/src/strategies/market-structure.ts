import { BacktestSignal, Direction, Bar, MarketStructureStats, Signal } from '@shared';
import PivotPointController from '../patterns/pivot-point';
import Base from '../base';

export default class MarketStructure extends Base {
  private pivotPointController = new PivotPointController();

  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const space: number = Number(params.space);
    state.marketStructure ??= {};
    this.pivotPointController.stepMarketStructure(bars, state.marketStructure, space);

    const bar: Bar = bars[bars.length - 1];
    const currentMarketStructureStats: MarketStructureStats | undefined = bar.chart?.marketStructure;
    if (!currentMarketStructureStats) return;

    if (!state.lastMarketStructureStats) {
      state.lastMarketStructureStats = currentMarketStructureStats;
      return;
    }

    if (currentMarketStructureStats.streak === 1 && state.lastMarketStructureStats.streak > 4) {
      const signals: BacktestSignal[] = bar.backtest.signals;
      const closePrice: number = bar.prices.close;

      if (currentMarketStructureStats.direction === Direction.Up) {
        signals.push({ signal: Signal.Buy, size: state.lastMarketStructureStats.streak, price: closePrice });
        state.barDone = true;
      } else if (currentMarketStructureStats.direction === Direction.Down) {
        signals.push({ signal: Signal.Sell, size: state.lastMarketStructureStats.streak, price: closePrice });
        state.barDone = true;
      }
    }

    state.lastMarketStructureStats = currentMarketStructureStats;
  }
}