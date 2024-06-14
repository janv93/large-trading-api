import { Algorithm, BacktestData, BacktestSignal, Kline, Signal } from '../../../../interfaces';
import Base from '../../../base';

export default class Momentum extends Base {
  public setSignals(klines: Kline[], algorithm: Algorithm, streak: number): Kline[] {
    const colors: number[] = klines.map(kline => this.getKlineColor(kline));

    klines.forEach((kline: any, index: number) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;
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

    return klines;
  }

  private getEntrySignal(colors: number[], index: number, streak: number): Signal | undefined {
    if (streak > index) {
      return undefined;
    }

    const range = colors.slice(index - streak + 1, index + 1);
    const rangeGreen = range.every(kline => kline >= 0);
    const rangeRed = range.every(kline => kline <= 0);
    const signal = rangeGreen ? Signal.Sell : rangeRed ? Signal.Buy : null
    return signal!;
  }
}