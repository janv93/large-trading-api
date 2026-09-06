import { stepMacd } from '../patterns/indicators/macd';
import { BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../base';

export default class Macd extends Base {
  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const fast = Number(params.fast);
    const slow = Number(params.slow);
    const signal = Number(params.signal);
    state.macd ??= {};
    stepMacd(bars, state.macd, fast, slow, signal);

    const bar: Bar = bars[bars.length - 1];
    const macd = bar.indicators?.macd;
    if (!macd) return;

    const backtest: BacktestData = bar.backtest!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;
    const h: number = macd.histogram;

    if (state.lastHistogram === undefined) {
      state.lastHistogram = h;
      return;
    }

    const move = h - state.lastHistogram > 0 ? 'up' : 'down';

    if (!state.lastMove) {
      state.lastMove = move;
    }

    const momentumSwitch = move !== state.lastMove;

    if (momentumSwitch) {
      if (!state.positionOpen) {
        if (move === 'down' && h > 0) {
          if (h > 0.003) {
            signals.push({ signal: Signal.CloseAll, price: closePrice });
            signals.push({ signal: Signal.Sell, size: 1, price: closePrice });
            state.positionOpen = true;
            state.positionOpenType = Signal.Sell;
            state.barDone = true;
          }
        } else if (move === 'up' && h < 0) {
          if (h < -0.003) {
            signals.push({ signal: Signal.CloseAll, price: closePrice });
            signals.push({ signal: Signal.Buy, size: 1, price: closePrice });
            state.positionOpen = true;
            state.positionOpenType = Signal.Buy;
            state.barDone = true;
          }
        }
      } else {
        if ((state.positionOpenType === Signal.Sell && h < 0) || (state.positionOpenType === Signal.Buy && h > 0)) {
          signals.push({ signal: Signal.CloseAll, price: closePrice });
          state.positionOpen = false;
          state.barDone = true;
        }
      }
    }

    state.lastHistogram = h;
    state.lastMove = move;
  }
}