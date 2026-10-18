import { Bar, Direction, MarketStructureStats, Signal } from '@shared';
import Base from '../base';
import MarketStructureController from '../patterns/pivot-point/market-structure';

export default class MarketStructure extends Base {
  private marketStructureController = new MarketStructureController();

  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const space: number = Number(params.space);
    state.marketStructure ??= {};
    this.marketStructureController.stepMarketStructure(bars, state.marketStructure, space);

    const bar: Bar = bars[bars.length - 1];
    const marketStructure: MarketStructureStats | undefined = bar.chart?.marketStructure;
    const previousMarketStructure: MarketStructureStats | undefined = bars.at(-2)?.chart?.marketStructure;
    if (!marketStructure || !previousMarketStructure) return;
    if (marketStructure.streak !== 1 || previousMarketStructure.streak <= 4) return;

    const signal: Signal = marketStructure.direction === Direction.Up ? Signal.Buy : Signal.Sell;
    bar.backtest.signals.push({ signal, size: previousMarketStructure.streak, price: bar.prices.close });
    state.barDone = true;
  }
}
