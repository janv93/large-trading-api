import IndicatorsController from '../technical-analysis/indicators-controller';
import { BinanceKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class RsiController extends BaseController {
  private indicatorsController: IndicatorsController;

  constructor() {
    super();
    this.indicatorsController = new IndicatorsController();
  }

  public setSignals(klines: Array<BinanceKline>, length: number): Array<BinanceKline> {
    const rsi = this.indicatorsController.rsi(klines, length);
    const klinesWithRsi = klines.slice(-rsi.length);
    this.overBoughtOverSold(klinesWithRsi, rsi);

    return klines;
  }

  private overBoughtOverSold(klines: Array<BinanceKline>, rsi: Array<any>): Array<BinanceKline> {
    const rsiThresholdHigh = 60;
    const rsiThresholdLow = 40;

    let lastSignal: string;

    klines.forEach((kline, index) => {
      const r = rsi[index].rsi;

      if (lastSignal === this.buySignal) {
        if (r > rsiThresholdHigh) {
          kline.signal = this.sellSignal;
          lastSignal = this.sellSignal;
        }
      } else if (lastSignal === this.sellSignal) {
        if (r < rsiThresholdLow) {
          kline.signal = this.buySignal;
          lastSignal = this.buySignal;
        }
      } else {
        if (r > rsiThresholdHigh) {
          kline.signal = this.sellSignal;
          lastSignal = this.sellSignal;
        } else if (r < rsiThresholdLow) {
          kline.signal = this.buySignal;
          lastSignal = this.buySignal;
        }
      }
    });

    return klines;
  }

}