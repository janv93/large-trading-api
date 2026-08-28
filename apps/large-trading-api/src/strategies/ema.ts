import { stepEma } from '../patterns/indicators/ema';
import { BacktestData, BacktestSignal, Bar, Signal, createSignal } from '@shared';
import Base from '../base';

export default class Ema extends Base {
  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const periodOpen = Number(params.periodOpen);
    const periodClose = Number(params.periodClose);
    state.emaOpen ??= {};
    state.emaClose ??= {};
    stepEma(bars, state.emaOpen, periodOpen);
    stepEma(bars, state.emaClose, periodClose);

    const bar: Bar = bars[bars.length - 1];
    const eOpen: number | undefined = bar.indicators?.ema?.[periodOpen];
    const eClose: number | undefined = bar.indicators?.ema?.[periodClose];
    if (eOpen === undefined || eClose === undefined) return;

    const backtest: BacktestData = bar.backtest!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    if (state.lastEmaOpen === undefined) {
      state.lastEmaOpen = eOpen;
      state.lastEmaClose = eClose;
      return;
    }

    const moveOpen = eOpen - state.lastEmaOpen > 0 ? 'up' : 'down';
    const moveClose = eClose - state.lastEmaClose! > 0 ? 'up' : 'down';

    if (state.lastMoveOpen === undefined) {
      state.lastMoveOpen = moveOpen;
      state.lastMoveClose = moveClose;
      state.lastEmaOpen = eOpen;
      state.lastEmaClose = eClose;
      return;
    }

    const momentumSwitchOpen = moveOpen !== state.lastMoveOpen;
    const momentumSwitchClose = moveClose !== state.lastMoveClose;

    if (state.positionOpen && momentumSwitchClose && state.lastMoveOpen !== moveClose) {
      signals.push(createSignal({ uniqueIdentifier: Signal.CloseAll, signal: Signal.CloseAll, price: closePrice }));
      state.positionOpen = false;
    }

    if (!state.positionOpen && momentumSwitchOpen) {
      if (moveOpen === 'up') {
        signals.push(createSignal({ uniqueIdentifier: Signal.CloseAll, signal: Signal.CloseAll, price: closePrice }));
        signals.push(createSignal({ uniqueIdentifier: Signal.Buy, signal: Signal.Buy, size: 1, price: closePrice }));
        state.positionOpen = true;
      } else if (moveOpen === 'down') {
        signals.push(createSignal({ uniqueIdentifier: Signal.CloseAll, signal: Signal.CloseAll, price: closePrice }));
        signals.push(createSignal({ uniqueIdentifier: Signal.Sell, signal: Signal.Sell, size: 1, price: closePrice }));
        state.positionOpen = true;
      }
    }

    state.lastMoveOpen = moveOpen;
    state.lastEmaOpen = eOpen;
    state.lastMoveClose = moveClose;
    state.lastEmaClose = eClose;
  }
}