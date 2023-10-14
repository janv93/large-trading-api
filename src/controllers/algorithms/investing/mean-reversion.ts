import { Kline } from '../../../interfaces';
import Base from '../../base';

enum Action {
  Buy,
  StartTrail,
  Close,
  SetHigh,
  Skip
}

export default class MeanReversion extends Base {
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
      minDrop: 0.25,
      streak: 0,
      peak: klines[0].prices.close,
      low: klines[0].prices.close,
      isOpen: false,
      isTrailing: false
    };

    for (const kline of klines) {
      const action: Action = this.getAction(kline, state);

      switch (action) {
        case Action.Buy: this.buy(kline, state); break;
        case Action.StartTrail: this.startTrail(kline, state); break;
        case Action.Close: this.close(kline, state); break;
        case Action.SetHigh: this.setHigh(kline, state); break;
      }
    }

    return klines;
  }

  private getAction(kline: Kline, state: any): Action {
    if (this.isBuy(kline, state)) {
      return Action.Buy;
    }

    if (this.isStartTrail(kline, state)) {
      return Action.StartTrail;
    }

    if (this.isClose(kline, state)) {
      return Action.Close;
    }

    if (this.isSetHigh(kline, state)) {
      return Action.SetHigh;
    }

    return Action.Skip;
  }

  private isBuy(kline: Kline, state: any): boolean {
    const close = kline.prices.close;
    const diffFromPeak = (state.peak - close) / state.peak;
    const excess = diffFromPeak - state.minDrop;
    const thresholdMultiple = excess / state.threshold;
    const minDropReached = diffFromPeak > state.minDrop;  // minimum drop to start buying
    const isBuy = thresholdMultiple > state.streak; // e.g. multiple of threshold = 2, streak = 1 -> buy again
    return minDropReached && isBuy;
  }

  private isStartTrail(kline: Kline, state: any): boolean {
    if (state.isTrailing) return false;

    const close = kline.prices.close;
    const diffFromLow = (close - state.low) / state.low;
    const diffFromLowSufficient = diffFromLow > 2 * state.threshold;
    return state.isOpen && diffFromLowSufficient;
  }

  private isClose(kline: Kline, state: any): boolean {
    if (!state.isOpen || !state.isTrailing) return false;

    const close = kline.prices.close;
    const diffFromPeak = (state.peak - close) / state.peak;
    const diffPeakLow = (state.peak - state.low) / state.peak;
    const stopLossReached = diffFromPeak / diffPeakLow > state.exitMultiplier; // stop loss as percentage of current profit
    return stopLossReached;
  }

  private isSetHigh(kline: Kline, state: any): boolean {
    const close = kline.prices.close;
    return (!state.isOpen || state.isTrailing) && close > state.peak;
  }

  private buy(kline: Kline, state: any) {
    kline.signal = this.buySignal;
    state.streak++;
    kline.amount = Math.pow(2, state.streak - 1); // start at 2^0
    state.isOpen = true;
    state.low = kline.prices.close;
  }

  private startTrail(kline: Kline, state: any) {
    state.isTrailing = true;
    state.peak = kline.prices.close;
  }

  private setHigh(kline: Kline, state: any) {
    state.peak = kline.prices.close;
  }

  private close(kline: Kline, state: any) {
    kline.signal = this.closeSignal;
    state.streak = 0;
    state.isOpen = false;
    state.isTrailing = false;
    state.peak = kline.prices.close;
  }
}