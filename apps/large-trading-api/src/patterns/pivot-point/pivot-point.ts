import { Bar, PivotPoint, PivotPointSide } from '@shared';
import Base from '../../base';

export default class PivotPointController extends Base {
  public stepPivotPoints(bars: Bar[], space: number): void {
    const pivotIndex: number = bars.length - 2 - space;
    if (pivotIndex < 0) return;

    const pivotPoint: PivotPoint | null = this.getPivotPoint(bars, pivotIndex, space);

    if (pivotPoint) {
      const bar: Bar = bars[pivotIndex];
      bar.chart = bar.chart || {};
      bar.chart.pivotPoint = pivotPoint;
    }
  }

  protected getPivotPoint(bars: Bar[], pivotIndex: number, space: number): PivotPoint | null {
    if (!bars[pivotIndex - space] || !bars[pivotIndex + space]) return null;

    const bar: Bar = bars[pivotIndex];
    const currentHigh: number = bar.prices.high;
    const currentLow: number = bar.prices.low;
    const leftBars: Bar[] = bars.slice(pivotIndex - space, pivotIndex);
    const rightBars: Bar[] = bars.slice(pivotIndex + 1, pivotIndex + space + 1);
    const isLeftHigh: boolean = leftBars.every((neighbour) => neighbour.prices.high <= currentHigh);
    const isRightHigh: boolean = rightBars.every((neighbour) => neighbour.prices.high <= currentHigh);
    const isLeftLow: boolean = leftBars.every((neighbour) => neighbour.prices.low >= currentLow);
    const isRightLow: boolean = rightBars.every((neighbour) => neighbour.prices.low >= currentLow);
    const isHigh: boolean = isLeftHigh && isRightHigh;
    const isLow: boolean = isLeftLow && isRightLow;
    const pivotPointSide: PivotPointSide | null = isHigh ? PivotPointSide.High : isLow ? PivotPointSide.Low : null;

    if (pivotPointSide) {
      return { space, side: pivotPointSide };
    }

    return null;
  }
}
