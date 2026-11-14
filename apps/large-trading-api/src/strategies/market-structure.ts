import { Bar, Direction, Signal } from '@shared';
import Base from '../base';
import MarketStructureController from '../patterns/pivot-point/market-structure';

export default class MarketStructure extends Base {
  private marketStructureController = new MarketStructureController();

  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    state.marketStructure ??= {};
    const reversalDirection: Direction | undefined = this.marketStructureController.stepMarketStructure(
      bars,
      state.marketStructure,
      Number(params.space),
    );

    if (reversalDirection) {
      const bar: Bar = bars[bars.length - 1];
      const signal: Signal = reversalDirection === Direction.Up ? Signal.Buy : Signal.Sell;
      bar.backtest.signals.push({ signal, size: 1, price: bar.prices.close });
      state.barDone = true;
    }
  }
}
