import IndicatorsController from '../technical-analysis/indicators-controller';
import { Kline } from '../../interfaces';
import BaseController from '../base-controller';

export default class RsiController extends BaseController {
  private indicatorsController: IndicatorsController;

  constructor() {
    super();
    this.indicatorsController = new IndicatorsController();
  }

  public setSignals(klines: Array<Kline>, length: number): Array<Kline> {
    const rsi = this.indicatorsController.rsi(klines, length);
    const klinesWithRsi = klines.slice(-rsi.length);
    this.setOverBoughtOverSoldSignals(klinesWithRsi, rsi);

    return klines;
  }

  private setOverBoughtOverSoldSignals(klines: Array<Kline>, rsi: Array<any>): Array<Kline> {
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