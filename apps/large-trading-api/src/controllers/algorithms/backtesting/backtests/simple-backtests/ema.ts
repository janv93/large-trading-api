import Indicators from '../../../patterns/indicators';
import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../../../../../base';

export default class Ema extends Base {
  private indicators = new Indicators();

  /**
   * sets position signals depending on emas going up or down
   */
  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const periodOpen = Number(params.periodOpen);
    const periodClose = Number(params.periodClose);
    this.indicators.addEma(bars, periodOpen);
    this.indicators.addEma(bars, periodClose);
    const barsWithEma = bars.filter(k => k.indicators?.ema?.[periodOpen] !== undefined && k.indicators?.ema?.[periodClose] !== undefined);

    let lastMoveOpen: string;
    let lastMoveClose: string;
    let lastEmaOpen: number;
    let lastEmaClose: number;
    let positionOpen = false;

    barsWithEma.forEach((bar, i) => {
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;
      const eOpen = bar.indicators!.ema![periodOpen];
      const eClose = bar.indicators!.ema![periodClose];

      // init

      if (i === 0) {
        lastEmaOpen = eOpen;
        lastEmaClose = eClose;
        return;
      }

      const moveOpen = eOpen - lastEmaOpen > 0 ? 'up' : 'down';
      const moveClose = eClose - lastEmaClose > 0 ? 'up' : 'down';

      if (i === 1) {
        lastMoveOpen = moveOpen;
        lastEmaOpen = eOpen;
        lastMoveClose = moveClose;
        lastEmaClose = eClose;
        return;
      }

      const momentumSwitchOpen = moveOpen !== lastMoveOpen;
      const momentumSwitchClose = moveClose !== lastMoveClose;

      // init end

      // set signals

      if (positionOpen && momentumSwitchClose && lastMoveOpen !== moveClose) {
        signals.push({
          signal: Signal.CloseAll,
          price: closePrice
        });

        positionOpen = false;
      }

      if (!positionOpen && momentumSwitchOpen) {
        if (moveOpen === 'up') {
          signals.push({
            signal: Signal.CloseAll,
            price: closePrice
          });

          signals.push({
            signal: Signal.Buy,
            size: 1,
            price: closePrice
          });

          positionOpen = true;
        } else if (moveOpen === 'down') {
          signals.push({
            signal: Signal.CloseAll,
            price: closePrice
          });

          signals.push({
            signal: Signal.Sell,
            size: 1,
            price: closePrice
          });

          positionOpen = true;
        }
      }

      // set signals end

      lastMoveOpen = moveOpen;
      lastEmaOpen = eOpen;
      lastMoveClose = moveClose;
      lastEmaClose = eClose;
    });
  }
}