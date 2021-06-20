import IndicatorsController from '../technical-analysis/indicators-controller';

export default class RsiController {
  private indicatorsController: IndicatorsController;

  constructor() {
    this.indicatorsController = new IndicatorsController();
  }

  public setSignals(klines: Array<any>, length: number): Array<any> {
    const rsi = this.indicatorsController.rsi(klines, length);
    const klinesWithRsi = klines.slice(-rsi.length);
    this.overBoughtOverSold(klinesWithRsi, rsi);

    return klines;
  }

  private overBoughtOverSold(klines: Array<any>, rsi: Array<any>): Array<any> {
    const rsiThresholdHigh = 70;
    const rsiThresholdLow = 30;
    const buySignal = 'BUY';
    const sellSignal = 'SELL';

    let lastSignal: string;

    klines.forEach((kline, index) => {
      const r = rsi[index].rsi;

      if (lastSignal === buySignal) {
        if (r > rsiThresholdHigh) {
          kline.push(sellSignal);
          lastSignal = sellSignal;
        }
      } else if (lastSignal === sellSignal) {
        if (r < rsiThresholdLow) {
          kline.push(buySignal);
          lastSignal = buySignal;
        }
      } else {
        if (r > rsiThresholdHigh) {
          kline.push(sellSignal);
          lastSignal = sellSignal;
        } else if (r < rsiThresholdLow) {
          kline.push(buySignal);
          lastSignal = buySignal;
        }
      }
    });

    return klines;
  }

  private rsi50(klines: Array<any>, rsi: Array<any>) {

  }

}