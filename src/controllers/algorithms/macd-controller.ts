import IndicatorsController from '../technical-analysis/indicators-controller';

export default class MacdController {
  private indicatorsController: IndicatorsController;

  constructor() {
    this.indicatorsController = new IndicatorsController();
  }

  public setSignals(klines: Array<any>, fast: string, slow: string, signal: string): Array<any> {
    const histogram = this.indicatorsController.macd(klines, fast, slow, signal);
    const klinesWithHistogram = klines.slice(klines.length - histogram.length, klines.length);

    let lastHistogram: number;
    let lastMove: string;
    let sumHighs = 0;
    let peakHigh = 0;
    let numberHighs = 0;
    let sumLows = 0;
    let peakLow = 0;
    let numberLows = 0;
    let positionOpen = false;
    let positionOpenType: string;

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

      // buy when macd h. is decreasing at high value or increasing at low value, sell when macd h. hits 0
      if (momentumSwitch) {
        if (!positionOpen) {
          if (move === 'down' && h > 0) {
            sumHighs += h;
            numberHighs++;
            peakHigh = h > peakHigh ? h : peakHigh;
            const averageHigh = sumHighs / numberHighs;

            if (h > (averageHigh + peakHigh) / 2) {
              kline.push('SELL');
              positionOpen = true;
              positionOpenType = 'SELL';
            }
          } else if (move === 'up' && h < 0) {
            sumLows += h;
            numberLows++;
            peakLow = h > peakLow ? h : peakLow;
            const averageLow = sumLows / numberLows;

            if (h < (averageLow + peakLow) / 2) {
              kline.push('BUY');
              positionOpen = true;
              positionOpenType = 'BUY';
            }
          }
        } else {
          if ((positionOpenType === 'SELL' && h < 0) || (positionOpenType === 'BUY' && h > 0)) {
            kline.push('CLOSE');
            positionOpen = false;
          }
        }
      }

      lastHistogram = h;
      lastMove = move;
    });


    return klines;
  }

}