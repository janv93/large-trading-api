import { Kline } from '../../../interfaces';
import Base from '../../base';

enum Action {
  Buy,
  Close,
  SetNewHigh,
  Skip
}

export default class Martingale extends Base {
  /**
   * 1. wait until drop of minDrop, then buy
   * 2. if further drops, buy exponentially more
   * 3. if increase from lowest drop sufficient, close position
   * 4. back to 1.
   */
  public setSignals(klines: Kline[], threshold: number, exitMultiplier: number): Kline[] {
    const state = {
      threshold,
      exitMultiplier,
      minDrop: 0.4,
      streak: 0,
      peak: klines[0].prices.close,
      low: klines[0].prices.close,
      isOpen: false
    };

    for (const kline of klines) {
      const action: Action = this.getAction(kline, state);

      switch (action) {
        case Action.Buy: this.buy(kline, state); break;
        case Action.Close: this.close(kline, state); break;
        case Action.SetNewHigh: state.peak = kline.prices.close; break;
        case Action.Skip:
        default: break;
      }
    }

    return klines;
  }

  private getAction(kline: Kline, state: any): Action {
    const close = kline.prices.close;
    const diffFromLow = (close - state.low) / state.low;
    const diffFromPeak = (state.peak - close) / state.peak;

    if (diffFromPeak > state.minDrop) {
      const excess = diffFromPeak - state.minDrop;
      const thresholdMultiple = excess / state.threshold;

      if (thresholdMultiple > state.streak) {
        return Action.Buy;
      } else {
        return Action.Skip;
      }
    }

    if (state.isOpen && diffFromLow > state.threshold * state.exitMultiplier) {
      return Action.Close;
    }

    if (!state.isOpen && close > state.peak) {
      return Action.SetNewHigh;
    }

    return Action.Skip;
  }

  private buy(kline: Kline, state: any) {
    kline.signal = this.buySignal;
    state.streak++;
    kline.amount = Math.pow(2, state.streak - 1); // start at 2^0
    state.isOpen = true;
    state.low = kline.prices.close;
  }

  private close(kline: Kline, state: any) {
    kline.signal = this.closeSignal;
    state.streak = 0;
    state.isOpen = false;
    state.peak = kline.prices.close;
  }
}