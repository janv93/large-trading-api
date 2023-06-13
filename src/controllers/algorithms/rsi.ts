import Indicators from '../technical-analysis/indicators';
import { Kline } from '../../interfaces';
import Base from '../base';

export default class Rsi extends Base {
  private indicators = new Indicators();

  public setSignals(klines: Kline[], length: number): Kline[] {
    const rsi = this.indicators.rsi(klines, length);
    const klinesWithRsi = klines.slice(-rsi.length);
    this.setOverBoughtOverSoldSignals(klinesWithRsi, rsi);

    return klines;
  }

  private setOverBoughtOverSoldSignals(klines: Kline[], rsi: any[]): Kline[] {
    const rsiThresholdHigh = 60;
    const rsiThresholdLow = 40;

    let lastSignal: string;

    klines.forEach((kline, index) => {
      const r = rsi[index].rsi;

      if (lastSignal === this.closeBuySignal) {
        if (r > rsiThresholdHigh) {
          kline.signal = this.closeSellSignal;
          lastSignal = this.closeSellSignal;
        }
      } else if (lastSignal === this.closeSellSignal) {
        if (r < rsiThresholdLow) {
          kline.signal = this.closeBuySignal;
          lastSignal = this.closeBuySignal;
        }
      } else {
        if (r > rsiThresholdHigh) {
          kline.signal = this.closeSellSignal;
          lastSignal = this.closeSellSignal;
        } else if (r < rsiThresholdLow) {
          kline.signal = this.closeBuySignal;
          lastSignal = this.closeBuySignal;
        }
      }
    });

    return klines;
  }

}