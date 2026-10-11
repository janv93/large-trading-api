import { BacktestSignal, Bar, Signal } from '@shared';
import Base from '../base';
import { stepEma } from '../patterns/indicators/ema';

export default class Ema extends Base {
  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const periodOpen = Number(params.periodOpen);
    const periodClose = Number(params.periodClose);
    stepEma(bars, periodOpen);
    stepEma(bars, periodClose);

    const bar: Bar = bars[bars.length - 1];
    const eOpen: number | undefined = bar.indicators?.ema?.[periodOpen];
    const eClose: number | undefined = bar.indicators?.ema?.[periodClose];
    const previousEmaOpen: number | undefined = bars.at(-2)?.indicators?.ema?.[periodOpen];
    const previousEmaClose: number | undefined = bars.at(-2)?.indicators?.ema?.[periodClose];
    const earlierEmaOpen: number | undefined = bars.at(-3)?.indicators?.ema?.[periodOpen];
    const earlierEmaClose: number | undefined = bars.at(-3)?.indicators?.ema?.[periodClose];

    if ([eOpen, eClose, previousEmaOpen, previousEmaClose, earlierEmaOpen, earlierEmaClose].includes(undefined)) return;

    const signals: BacktestSignal[] = bar.backtest.signals;
    const closePrice: number = bar.prices.close;
    const moveOpen = eOpen! - previousEmaOpen! > 0 ? 'up' : 'down';
    const moveClose = eClose! - previousEmaClose! > 0 ? 'up' : 'down';
    const previousMoveOpen = previousEmaOpen! - earlierEmaOpen! > 0 ? 'up' : 'down';
    const previousMoveClose = previousEmaClose! - earlierEmaClose! > 0 ? 'up' : 'down';
    const momentumSwitchOpen = moveOpen !== previousMoveOpen;
    const momentumSwitchClose = moveClose !== previousMoveClose;

    if (state.positionOpen && momentumSwitchClose && previousMoveOpen !== moveClose) {
      signals.push({ signal: Signal.CloseAll, price: closePrice });
      state.positionOpen = false;
      state.barDone = true;
    }

    if (!state.positionOpen && momentumSwitchOpen) {
      if (moveOpen === 'up') {
        signals.push({ signal: Signal.CloseAll, price: closePrice });
        signals.push({ signal: Signal.Buy, size: 1, price: closePrice });
        state.positionOpen = true;
        state.barDone = true;
      } else if (moveOpen === 'down') {
        signals.push({ signal: Signal.CloseAll, price: closePrice });
        signals.push({ signal: Signal.Sell, size: 1, price: closePrice });
        state.positionOpen = true;
        state.barDone = true;
      }
    }
  }
}
