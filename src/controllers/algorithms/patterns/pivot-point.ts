import Base from '../../../base';
import { Kline, PivotPoint, PivotPointSide } from '../../../interfaces';

export default class PivotPointController extends Base {
  // add pivot points defined by horizontally uninterrupted highs/lows on the left and right side
  public addPivotPoints(klines: Kline[], leftLength: number, rightLength: number): void {
    klines.forEach((kline: Kline, i: number) => {
      const pivotPoint: PivotPoint | null = this.getPivotPoint(klines, i, leftLength, rightLength);

      if (pivotPoint) {
        kline.chart = kline.chart || {};
        kline.chart.pivotPoint = pivotPoint;
      }
    });
  }

  public getPivotPoint(klines: Kline[], i: number, leftLength: number, rightLength: number, side?: PivotPointSide): PivotPoint | null {
    if (!klines[i - leftLength] && klines[i + rightLength]) return null;

    const kline: Kline = klines[i];
    const currentHigh: number = kline.prices.high;
    const currentLow: number = kline.prices.low;
    const isLeftHigh: boolean = klines.slice(i - leftLength + 1, i).every(k => k.prices.high <= currentHigh);
    const isRightHigh: boolean = klines.slice(i + 1, i + rightLength).every(k => k.prices.high <= currentHigh);
    const isLeftLow: boolean = klines.slice(i - leftLength + 1, i).every(k => k.prices.low >= currentLow);
    const isRightLow: boolean = klines.slice(i + 1, i + rightLength).every(k => k.prices.low >= currentLow);
    const isHigh: boolean = isLeftHigh && isRightHigh;
    const isLow: boolean = isLeftLow && isRightLow;
    const pivotPointSide: PivotPointSide | null = isHigh ? PivotPointSide.High : isLow ? PivotPointSide.Low : null;

    if (side && pivotPointSide !== side) return null;

    if (pivotPointSide) {
      return { left: leftLength, right: rightLength, side: pivotPointSide };
    }

    return null;
  }
}