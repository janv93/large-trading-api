import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import { getBarColor } from '@shared';
import Base from '../../../../../base';

export default class Momentum extends Base {
  public stepSetSignals(bars: Bar[], state: any, algorithm: Algorithm, params: any): void {
    const streak = Number(params.streak);
    const i: number = bars.length - 1;
    const bar: Bar = bars[i];
    const backtest: BacktestData = bar.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    const entrySignal: Signal | undefined = this.getEntrySignal(bars, i, streak);

    if (entrySignal) {
      signals.push({
        signal: entrySignal,
        size: 1,
        price: closePrice,
        positionCloseTrigger: { tpSl: { takeProfit: 0.006, stopLoss: 0.003 } }
      });
    }
  }

  private getEntrySignal(bars: Bar[], index: number, streak: number): Signal | undefined {
    if (streak > index) {
      return undefined;
    }

    let rangeGreen = true;
    let rangeRed = true;

    for (let i = index - streak + 1; i <= index; i++) {
      const color: number = getBarColor(bars[i]);
      if (color < 0) rangeGreen = false;
      if (color > 0) rangeRed = false;
    }

    return rangeGreen ? Signal.Sell : rangeRed ? Signal.Buy : undefined;
  }
}