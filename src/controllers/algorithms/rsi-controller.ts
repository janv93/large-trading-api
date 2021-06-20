import IndicatorsController from '../technical-analysis/indicators-controller';

export default class RsiController {
  private indicatorsController: IndicatorsController;

  constructor() {
    this.indicatorsController = new IndicatorsController();
  }

  public setSignals(klines: Array<any>, length: number): Array<any> {
    const rsi = this.indicatorsController.rsi(klines, length);
    const klinesWithRsi = klines.slice(-rsi.length);
    const rsiThresholdHigh = 70;
    const rsiThresholdLow = 30;
    const buySignal = 'BUY';
    const sellSignal = 'SELL';

    let lastSignal: string;

    klinesWithRsi.forEach((kline, index) => {
      const r = rsi[index].rsi;

      if (lastSignal === buySignal) {
        if (r > rsiThresholdHigh) {
          kline.push(sellSignal);
        }
      } else if (lastSignal === sellSignal) {
        if (r < rsiThresholdLow) {
          kline.push(buySignal);
        }
      } else {
        if (r > rsiThresholdHigh) {
          kline.push(sellSignal);
        } else if (r < rsiThresholdLow) {
          kline.push(buySignal);
        }
      }
    });

    return klines;
  }

}