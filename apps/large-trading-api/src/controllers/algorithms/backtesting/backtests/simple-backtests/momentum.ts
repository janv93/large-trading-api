import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import { getBarColor } from '@shared';
import Base from '../../../../../base';

export default class Momentum extends Base {
  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const colors: number[] = bars.map(bar => getBarColor(bar));
    const streak = Number(params.streak);

    bars.forEach((bar: any, index: number) => {
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;
      const entrySignal: Signal | undefined = this.getEntrySignal(colors, index, streak);

      if (entrySignal) {
        signals.push({
          signal: entrySignal,
          size: 1,
          price: closePrice,
          positionCloseTrigger: {
            tpSl: {
              takeProfit: 0.006,
              stopLoss: 0.003
            }
          }
        });
      }
    });

  }

  private getEntrySignal(colors: number[], index: number, streak: number): Signal | undefined {
    if (streak > index) {
      return undefined;
    }

    const range: number[] = colors.slice(index - streak + 1, index + 1);
    const rangeGreen: boolean = range.every(bar => bar >= 0);
    const rangeRed: boolean = range.every(bar => bar <= 0);
    const signal = rangeGreen ? Signal.Sell : rangeRed ? Signal.Buy : undefined;
    return signal;
  }
}