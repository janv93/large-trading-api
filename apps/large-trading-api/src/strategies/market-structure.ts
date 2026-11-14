import { Bar, Direction, MarketStructureStats, Signal } from '@shared';
import Base from '../base';
import MarketStructureController from '../patterns/pivot-point/market-structure';

export default class MarketStructure extends Base {
  private readonly controller = new MarketStructureController();

  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    state.marketStructure ??= {};
    const reversal: Direction | undefined = this.controller.stepMarketStructure(bars, state.marketStructure, Number(params.space));
    const previousTrend: MarketStructureStats | undefined = bars.at(-2)?.chart?.marketStructure;

    if (reversal && previousTrend && previousTrend.streak > 4) {
      bars.at(-1)!.backtest.signals.push({
        signal: reversal === Direction.Up ? Signal.Buy : Signal.Sell,
        size: previousTrend.streak,
        price: bars.at(-1)!.prices.close,
      });
      state.barDone = true;
    }
  }
}
