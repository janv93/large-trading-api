import IndicatorsController from '../technical-analysis/indicators-controller';
import { BinanceKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class EmaController extends BaseController {
  private indicatorsController: IndicatorsController;

  constructor() {
    super();
    this.indicatorsController = new IndicatorsController();
  }

  public setSignals(klines: Array<BinanceKline>, period: number): Array<BinanceKline> {
    const ema = this.indicatorsController.ema(klines, period);
    const klinesWithEma = klines.slice(-ema.length);

    let lastSignal: string;
    let lastEma: number;

    klinesWithEma.forEach((kline, index) => {
      const e = ema[index].ema;

      if (lastSignal === this.buySignal) {
        if (e < lastEma) {
          kline.signal = this.sellSignal;
          lastSignal = this.sellSignal;
        }
      } else if (lastSignal === this.sellSignal) {
        if (e > lastEma) {
          kline.signal = this.buySignal;
          lastSignal = this.buySignal;
        }
      } else {
        if (lastEma) {
          if (e > lastEma) {
            kline.signal = this.buySignal;
            lastSignal = this.buySignal;
          } else {
            kline.signal = this.sellSignal;
            lastSignal = this.sellSignal;
          }
        }
      }

      lastEma = e;
    });

    return klines;
  }

}