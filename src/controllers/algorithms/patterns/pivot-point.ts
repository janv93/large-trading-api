import Base from '../../../base';
import { Kline, PivotPointSide } from '../../../interfaces';

export default class PivotPointController extends Base {
  // add pivot points defined by horizontally uninterrupted highs/lows on the left and right side
  public addPivotPoints(klines: Kline[], leftLength: number, rightLength: number): void {
    klines.forEach((kline: Kline, i: number) => {
      const currentHigh = kline.prices.high;
      const currentLow = kline.prices.low;

      if (klines[i - leftLength] && klines[i + rightLength]) {
        const isLeftHigh: boolean = klines.slice(i - leftLength + 1, i).every(k => k.prices.high <= currentHigh);
        const isRightHigh: boolean = klines.slice(i + 1, i + rightLength).every(k => k.prices.high <= currentHigh);
        const isLeftLow: boolean = klines.slice(i - leftLength + 1, i).every(k => k.prices.low >= currentLow);
        const isRightLow: boolean = klines.slice(i + 1, i + rightLength).every(k => k.prices.low >= currentLow);
        const isHigh = isLeftHigh && isRightHigh;
        const isLow = isLeftLow && isRightLow;

        if (isHigh || isLow) {
          kline.chart = kline.chart || {};
          kline.chart.pivotPoints = kline.chart.pivotPoints || [];

          kline.chart.pivotPoints.push({
            left: leftLength,
            right: rightLength,
            side: isHigh ? PivotPointSide.High : PivotPointSide.Low
          });
        }
      }
    });
  }
}