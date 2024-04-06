import { Kline, PivotPoint, PivotPointSide, Position, Slope } from '../../../interfaces';

export default class Charting {
  public addPivotPoints(klines: Kline[], leftLength: number, rightLength: number): void {
    klines.forEach((kline: Kline, i: number) => {
      const currentHigh = kline.prices.high;
      const currentLow = kline.prices.low;

      if (klines[i - leftLength] && klines[i + rightLength]) {
        const leftKlines = klines.slice(0, i);
        const rightKlines = klines.slice(i + 1);

        let leftLengthHigh: number = leftKlines.slice().reverse().findIndex((leftKline: Kline) => leftKline.prices.high > currentHigh);
        leftLengthHigh = leftLengthHigh === -1 ? Infinity : leftLengthHigh;
        let rightLengthHigh: number = rightKlines.findIndex((rightKline: Kline) => rightKline.prices.high > currentHigh);
        rightLengthHigh = rightLengthHigh === -1 ? Infinity : rightLengthHigh;
        const isHigh = leftLengthHigh >= leftLength && rightLengthHigh >= rightLength

        let leftLenthLow: number = leftKlines.slice().reverse().findIndex((leftKline: Kline) => leftKline.prices.low < currentLow);
        leftLenthLow = leftLenthLow === -1 ? Infinity : leftLenthLow;
        let rightLengthLow: number = rightKlines.findIndex((rightKline: Kline) => rightKline.prices.low < currentLow);
        rightLengthLow = rightLengthLow === -1 ? Infinity : rightLengthLow;
        const isLow = leftLenthLow >= leftLength && rightLengthLow >= rightLength;

        if (isHigh) {
          kline.chartData = kline.chartData || {};
          kline.chartData.pivotPoints = kline.chartData.pivotPoints || [];

          kline.chartData.pivotPoints.push({
            left: leftLengthHigh,
            right: rightLengthHigh,
            side: PivotPointSide.High
          });
        } else if (isLow) {
          kline.chartData = kline.chartData || {};
          kline.chartData.pivotPoints = kline.chartData.pivotPoints || [];

          kline.chartData.pivotPoints.push({
            left: leftLenthLow,
            right: rightLengthLow,
            side: PivotPointSide.Low
          });
        }
      }
    });
  }

  public addTrendLines(klines: Kline[], minLength: number, maxLength: number): void {
    for (let i = 0; i < klines.length; i++) {
      const kline = klines[i];

      if (!kline.chartData?.pivotPoints?.length) continue;

      const ppStart: PivotPoint = kline.chartData.pivotPoints[0];
      const ppStartSide: PivotPointSide = ppStart.side
      const ppStartPrice = ppStartSide === PivotPointSide.High ? kline.prices.high : kline.prices.low;

      if (!klines[i + minLength] || !klines[i + maxLength]) continue;

      const klinesInRange: Kline[] = klines.slice(i + minLength, i + maxLength);

      klinesInRange.forEach((k: Kline, j: number) => {
        const endIndex = i + minLength + j;
        const isSameSide = k.chartData?.pivotPoints?.[0].side === ppStartSide;

        if (isSameSide) {
          const ppEndPrice = ppStartSide === PivotPointSide.High ? k.prices.high : k.prices.low;
          const isValid: boolean = this.isValidTrendLine(klines, i, endIndex, ppStartPrice, ppEndPrice, ppStartSide);

          if (isValid) {
            kline.chartData!.trendLines = kline.chartData!.trendLines || [];

            kline.chartData!.trendLines.push({
              endIndex: endIndex,
              length: endIndex - i,
              slope: ppStartPrice < ppEndPrice ? Slope.Ascending : Slope.Descending,
              position: ppStartSide === PivotPointSide.High ? Position.Above : Position.Below
            });
          }
        }
      });
    }
  }

  private isValidTrendLine(klines: Kline[], startIndex: number, endIndex: number, startPrice: number, endPrice: number, side: PivotPointSide): boolean {
    const x1: number = startIndex;
    const x2: number = endIndex;
    const y1: number = startPrice;
    const y2: number = endPrice;
    const m: number = (y2 - y1) / (x2 - x1);
    const b: number = y1 - m * x1;

    const lineUninterrupted = klines.slice(startIndex, endIndex).every((k: Kline, i: number) => {
      const x = startIndex + i;

      if (side === PivotPointSide.High) {
        const y = k.prices.high;
        const maxY = m * x + b;
        return y <= maxY;
      } else {
        const y = k.prices.low;
        const minY = m * x + b;
        return y >= minY;
      }
    });

    return lineUninterrupted;
  }
}