import IndicatorsController from '../technical-analysis/indicators-controller';

export default class MacdController {
  private indicatorsController: IndicatorsController;

  constructor() {
    this.indicatorsController = new IndicatorsController();
  }

  public setSignals(klines: Array<any>, fast: string, slow: string, signal: string): Array<any> {
    const histogram = this.indicatorsController.macd(klines, fast, slow, signal);

    let lastHistogram: number;
    let lastMove: string;

    const klinesWithHistogram = klines.slice(klines.length - histogram.length, klines.length);

    klinesWithHistogram.forEach((kline, index) => {
      const h = histogram[index].histogram;

      if (!lastHistogram) {
        lastHistogram = h;
        return;
      }

      if (!lastMove) {
        lastMove = h - lastHistogram > 0 ? 'up' : 'down';
      }

      const move = h - lastHistogram > 0 ? 'up' : 'down';
      const momentumSwitch = move !== lastMove;

      if (momentumSwitch) {
        const entry = move === 'up' ? 'BUY' : 'SELL';
        kline.push(entry);
      }

      lastHistogram = h;
      lastMove = move;
    });


    return klines;
  }

}