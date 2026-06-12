import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../../../../../base';

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
  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const threshold: number = Number(params.threshold);
    const profitBasedTrailingStopLoss: number = Number(params.profitBasedTrailingStopLoss);
    const startStreak: number = Number(params.startStreak);

    const state = {
      threshold,
      profitBasedTrailingStopLoss,
      minDrop: 0.25,
      streak: startStreak,
      peak: bars[0].prices.close,
      low: bars[0].prices.close,
      isOpen: false,
      isTrailing: false
    };

    for (const bar of bars) {
      const action: Action = this.getAction(bar, state);

      switch (action) {
        case Action.Buy: this.buy(bar, state, algorithm); break;
        case Action.StartTrail: this.startTrail(bar, state); break;
        case Action.Close: this.close(bar, state, algorithm, startStreak); break;
        case Action.SetHigh: this.setHigh(bar, state); break;
      }
    }

  }

  private getAction(bar: Bar, state: any): Action {
    if (this.isBuy(bar, state)) {
      return Action.Buy;
    }

    if (this.isStartTrail(bar, state)) {
      return Action.StartTrail;
    }

    if (this.isClose(bar, state)) {
      return Action.Close;
    }

    if (this.isSetHigh(bar, state)) {
      return Action.SetHigh;
    }

    return Action.Skip;
  }

  private isBuy(bar: Bar, state: any): boolean {
    const close: number = bar.prices.close;
    const diffFromPeak: number = (state.peak - close) / state.peak;
    const excess: number = diffFromPeak - state.minDrop;
    const thresholdMultiple: number = excess / state.threshold;
    const minDropReached: boolean = diffFromPeak > state.minDrop;  // minimum drop to start buying
    const isBuy: boolean = thresholdMultiple > state.streak; // e.g. multiple of threshold = 2, streak = 1 -> buy again
    return minDropReached && isBuy;
  }

  private isStartTrail(bar: Bar, state: any): boolean {
    if (state.isTrailing) return false;

    const close: number = bar.prices.close;
    const diffFromLow: number = (close - state.low) / state.low;
    const diffFromLowSufficient: boolean = diffFromLow > 2 * state.threshold;
    return state.isOpen && diffFromLowSufficient;
  }

  private isClose(bar: Bar, state: any): boolean {
    if (!state.isOpen || !state.isTrailing) return false;

    const close: number = bar.prices.close;
    const diffFromPeak: number = (state.peak - close) / state.peak;
    const diffPeakLow: number = (state.peak - state.low) / state.peak;
    const stopLossReached: boolean = diffFromPeak / diffPeakLow > state.profitBasedTrailingStopLoss; // stop loss as percentage of current profit
    return stopLossReached;
  }

  private isSetHigh(bar: Bar, state: any): boolean {
    const close: number = bar.prices.close;
    return (!state.isOpen || state.isTrailing) && close > state.peak;
  }

  private buy(bar: Bar, state: any, algorithm: Algorithm) {
    const backtest: BacktestData = bar.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    signals.push({
      signal: Signal.Buy,
      size: Math.pow(2, state.streak),  // start at 2^0
      price: closePrice
    });

    state.streak++;
    state.isOpen = true;
    state.low = bar.prices.close;
  }

  private startTrail(bar: Bar, state: any) {
    state.isTrailing = true;
    state.peak = bar.prices.close;
  }

  private setHigh(bar: Bar, state: any) {
    state.peak = bar.prices.close;
  }

  private close(bar: Bar, state: any, algorithm: Algorithm, startStreak: number) {
    const backtest: BacktestData = bar.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    signals.push({
      signal: Signal.CloseAll,
      price: closePrice
    });

    state.streak = startStreak;
    state.isOpen = false;
    state.isTrailing = false;
    state.peak = bar.prices.close;
  }
}