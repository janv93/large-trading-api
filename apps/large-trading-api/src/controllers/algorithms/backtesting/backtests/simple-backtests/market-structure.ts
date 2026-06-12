import { BacktestSignal, Direction, Bar, MarketStructureStats, Signal } from '@shared';
import PivotPointController from '../../../patterns/pivot-point';
import Base from '../../../../../base';

export default class MarketStructure extends Base {
  private pivotPointController = new PivotPointController();

  public setSignals(bars: Bar[], algorithm, params: any): void {
    const space: number = Number(params.space);
    this.pivotPointController.addMarketStructure(bars, space);
    let lastMarketStructureStats: MarketStructureStats | undefined = undefined;

    bars.forEach((bar: Bar, i: number) => {
      const currentMarketStructureStats: MarketStructureStats | undefined = bar.chart?.marketStructure;
      if (!currentMarketStructureStats) return;

      if (!lastMarketStructureStats) {
        lastMarketStructureStats = currentMarketStructureStats;
        return;
      }

      // when a big streak is broken, buy the opposite side
      if (currentMarketStructureStats!.streak === 1 && lastMarketStructureStats.streak > 4) {
        const signals: BacktestSignal[] = bar.algorithms[algorithm]!.signals;
        const closePrice: number = bar.prices.close;

        if (currentMarketStructureStats.direction === Direction.Up) {
          signals.push({
            signal: Signal.Buy,
            size: lastMarketStructureStats.streak,
            price: closePrice
          });
        } else if (currentMarketStructureStats.direction === Direction.Down) {
          signals.push({
            signal: Signal.Sell,
            size: lastMarketStructureStats.streak,
            price: closePrice
          });
        }
      }

      lastMarketStructureStats = currentMarketStructureStats;
    });

  }
}