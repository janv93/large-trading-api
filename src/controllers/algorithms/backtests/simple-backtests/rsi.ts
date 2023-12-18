import Indicators from '../../../technical-analysis/indicators';
import { Kline, Signal } from '../../../../interfaces';
import Base from '../../../base';

export default class Rsi extends Base {
  private indicators = new Indicators();

  public setSignals(klines: Kline[], algorithm: string, length: number): Kline[] {
    const rsi = this.indicators.rsi(klines, length);
    const klinesWithRsi = klines.slice(-rsi.length);
    this.setSignalsOverBoughtOverSold(klinesWithRsi, algorithm, rsi);

    return klines;
  }

  private setSignalsOverBoughtOverSold(klines: Kline[], algorithm: string, rsi: any[]): Kline[] {
    const rsiThresholdHigh = 60;
    const rsiThresholdLow = 40;

    let lastSignal: Signal;

    klines.forEach((kline, index) => {
      const r = rsi[index].rsi;

      if (lastSignal === Signal.CloseBuy) {
        if (r > rsiThresholdHigh) {
          kline.algorithms[algorithm].signal = Signal.CloseSell;
          lastSignal = Signal.CloseSell;
        }
      } else if (lastSignal === Signal.CloseSell) {
        if (r < rsiThresholdLow) {
          kline.algorithms[algorithm].signal = Signal.CloseBuy;
          lastSignal = Signal.CloseBuy;
        }
      } else {
        if (r > rsiThresholdHigh) {
          kline.algorithms[algorithm].signal = Signal.CloseSell;
          lastSignal = Signal.CloseSell;
        } else if (r < rsiThresholdLow) {
          kline.algorithms[algorithm].signal = Signal.CloseBuy;
          lastSignal = Signal.CloseBuy;
        }
      }
    });

    return klines;
  }

}