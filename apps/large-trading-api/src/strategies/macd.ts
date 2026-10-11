import { BacktestSignal, Bar, Signal } from '@shared';
import Base from '../base';
import { stepMacd } from '../patterns/indicators/macd';

export default class Macd extends Base {
  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const fast = Number(params.fast);
    const slow = Number(params.slow);
    const signal = Number(params.signal);
    stepMacd(bars, fast, slow, signal);

    const bar: Bar = bars[bars.length - 1];
    const macd = bar.indicators?.macd;
    const histogramOneAgo: number | undefined = bars.at(-2)?.indicators?.macd?.histogram;
    const histogramTwoAgo: number | undefined = bars.at(-3)?.indicators?.macd?.histogram;
    if (!macd || [histogramOneAgo, histogramTwoAgo].includes(undefined)) return;

    const signals: BacktestSignal[] = bar.backtest.signals;
    const closePrice: number = bar.prices.close;
    const histogram: number = macd.histogram;
    const move = histogram - histogramOneAgo! > 0 ? 'up' : 'down';
    const previousMove = histogramOneAgo! - histogramTwoAgo! > 0 ? 'up' : 'down';
    const momentumSwitch = move !== previousMove;

    if (momentumSwitch) {
      if (!state.positionOpen) {
        if (move === 'down' && histogram > 0) {
          if (histogram > 0.003) {
            signals.push({ signal: Signal.CloseAll, price: closePrice });
            signals.push({ signal: Signal.Sell, size: 1, price: closePrice });
            state.positionOpen = true;
            state.positionOpenType = Signal.Sell;
            state.barDone = true;
          }
        } else if (move === 'up' && histogram < 0) {
          if (histogram < -0.003) {
            signals.push({ signal: Signal.CloseAll, price: closePrice });
            signals.push({ signal: Signal.Buy, size: 1, price: closePrice });
            state.positionOpen = true;
            state.positionOpenType = Signal.Buy;
            state.barDone = true;
          }
        }
      } else {
        if ((state.positionOpenType === Signal.Sell && histogram < 0) || (state.positionOpenType === Signal.Buy && histogram > 0)) {
          signals.push({ signal: Signal.CloseAll, price: closePrice });
          state.positionOpen = false;
          state.barDone = true;
        }
      }
    }
  }
}
