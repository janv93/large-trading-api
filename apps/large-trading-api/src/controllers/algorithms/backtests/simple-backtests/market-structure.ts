import { BacktestSignal, Direction, Kline, MarketStructureStats, Signal } from '@shared';
import Base from '../../../../base';
import PivotPointController from '../../patterns/pivot-point';


export default class MarketStructure extends Base {
  private pivotPointController = new PivotPointController();

  public setSignals(klines: Kline[], algorithm, space: number): Kline[] {
    this.pivotPointController.addMarketStructure(klines, space);
    let lastMarketStructureStats: MarketStructureStats | undefined = undefined;

    klines.forEach((kline: Kline, i: number) => {
      const currentMarketStructureStats: MarketStructureStats | undefined = kline.chart?.marketStructure;
      if (!currentMarketStructureStats) return;

      if (!lastMarketStructureStats) {
        lastMarketStructureStats = currentMarketStructureStats;
        return;
      }

      // when a big streak is broken, buy the opposite side
      if (currentMarketStructureStats!.streak === 1 && lastMarketStructureStats.streak > 4) {
        const signals: BacktestSignal[] = kline.algorithms[algorithm]!.signals;
        const closePrice: number = kline.prices.close;

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

    return klines;
  }
}