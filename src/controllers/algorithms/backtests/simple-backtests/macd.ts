import Indicators from '../../../technical-analysis/indicators';
import { Kline, Signal } from '../../../../interfaces';
import Base from '../../../base';

export default class Macd extends Base {
  private indicators = new Indicators();

  public setSignals(klines: Kline[], algorithm: string, fast: number, slow: number, signal: number): Kline[] {
    const histogram = this.indicators.macd(klines, fast, slow, signal);
    const klinesWithHistogram = klines.slice(-histogram.length);

    let lastHistogram: number;
    let lastMove: string;
    let sumHighs = 0;
    let peakHigh = 0;
    let numberHighs = 0;
    let sumLows = 0;
    let peakLow = 0;
    let numberLows = 0;
    let positionOpen = false;
    let positionOpenType: Signal;

    klinesWithHistogram.forEach((kline, index) => {
      const h = histogram[index].histogram;

      if (!lastHistogram) {
        lastHistogram = h;
        return;
      }

      const move = h - lastHistogram > 0 ? 'up' : 'down';

      if (!lastMove) {
        lastMove = move;
      }

      const momentumSwitch = move !== lastMove;

      // buy when histogram is decreasing at high value or increasing at low value, sell when histogram hits 0
      if (momentumSwitch) {
        if (!positionOpen) {
          if (move === 'down' && h > 0) {
            sumHighs += h;
            numberHighs++;
            peakHigh = h > peakHigh ? h : peakHigh;

            if (h > 0.003) {
              kline.algorithms[algorithm].signal = Signal.CloseSell;
              positionOpen = true;
              positionOpenType = Signal.CloseSell;
            }
          } else if (move === 'up' && h < 0) {
            sumLows += h;
            numberLows++;
            peakLow = h < peakLow ? h : peakLow;

            if (h < -0.003) {
              kline.algorithms[algorithm].signal = Signal.CloseBuy;
              positionOpen = true;
              positionOpenType = Signal.CloseBuy;
            }
          }
        } else {
          if ((positionOpenType === Signal.CloseSell && h < 0) || (positionOpenType === Signal.CloseBuy && h > 0)) {
            kline.algorithms[algorithm].signal = Signal.Close;
            positionOpen = false;
          }
        }
      }

      lastHistogram = h;
      lastMove = move;
    });

    return klines;
  }

  /**
   * test different histogram strategies
   */
  private findOptimalEntry(klines: Kline[], histogram: any[]) {
    let lastHistogram: number;
    let lastMove: string;
    let sumDiffs = 0.0;
    let numberDiffs = 0.0;

    klines.forEach((kline, index) => {
      const h = histogram[index].histogram;
      const currentPrice = Number(kline.prices.close);

      if (!lastHistogram) {
        lastHistogram = h;
        return;
      }

      if (!lastMove) {
        lastMove = h - lastHistogram > 0 ? 'up' : 'down';
      }

      const move = h - lastHistogram > 0 ? 'up' : 'down';
      const momentumSwitch = move !== lastMove;

      const kline5Steps = klines[index + 20];
      const price5Steps = kline5Steps ? Number(kline5Steps.prices.close) : null;

      if (momentumSwitch && move === 'up') {
        if (price5Steps) {
          const priceDiff = price5Steps - currentPrice;
          sumDiffs += priceDiff;
          numberDiffs++;
        }
      }
    });

    const averageDiff = sumDiffs / numberDiffs;
    console.log(averageDiff);
  }


}