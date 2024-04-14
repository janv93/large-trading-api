import { Kline, PivotPoint, PivotPointSide, Position, Slope } from '../../../interfaces';
import { LinearFunction } from './linear-function';

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
          kline.chart = kline.chart || {};
          kline.chart.pivotPoints = kline.chart.pivotPoints || [];

          kline.chart.pivotPoints.push({
            left: leftLengthHigh,
            right: rightLengthHigh,
            side: PivotPointSide.High
          });
        } else if (isLow) {
          kline.chart = kline.chart || {};
          kline.chart.pivotPoints = kline.chart.pivotPoints || [];

          kline.chart.pivotPoints.push({
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

      if (!kline.chart?.pivotPoints?.length) continue;  // if no pivot points, skip kline

      const ppStart: PivotPoint = kline.chart.pivotPoints[0];
      const ppStartSide: PivotPointSide = ppStart.side
      const ppStartPrice = ppStartSide === PivotPointSide.High ? kline.prices.high : kline.prices.low;
      const klinesInRange: Kline[] = klines.slice(i + minLength, i + maxLength);

      if (!klinesInRange.length) continue;

      klinesInRange.forEach((k: Kline, j: number) => {
        const endIndex = i + minLength + j;
        const isSameSide = k.chart?.pivotPoints?.[0].side === ppStartSide;

        if (isSameSide) {
          const ppEndPrice = ppStartSide === PivotPointSide.High ? k.prices.high : k.prices.low;
          const valid: boolean = this.isValidTrendLine(klines, i, endIndex, ppStartPrice, ppEndPrice, ppStartSide);

          if (valid) {
            kline.chart!.trendLines = kline.chart!.trendLines || [];

            kline.chart!.trendLines.push({
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
    const lineFunction = new LinearFunction(startIndex, startPrice, endIndex, endPrice);
    const uninterrupted = this.trendLineIsUninterrupted(klines, lineFunction, startIndex, endIndex, side);
    const length = endIndex - startIndex;
    const leftBuffer = length * 0.2;  // some buffer to the left of the start of the line
    const leftBufferUninterrupted = this.trendLineIsUninterrupted(klines, lineFunction, startIndex - leftBuffer, startIndex, side); // make sure line extends uninterrupted to the left beyond the start, similar to how a pivot point must have some left klines to be valid
    return uninterrupted && leftBufferUninterrupted;
  }

  // checks if trend line from A to B has no klines in between that cross the line
  private trendLineIsUninterrupted(klines: Kline[], lineFunction: LinearFunction, startIndex: number, endIndex: number, side: PivotPointSide): boolean {
    const lineUninterrupted = klines.slice(startIndex + 1, endIndex).every((k: Kline, i: number) => {
      const x = startIndex + i;

      if (side === PivotPointSide.High) {
        const y = k.prices.high;
        const maxY = lineFunction.m * x + lineFunction.b;
        return y <= maxY;
      } else {
        const y = k.prices.low;
        const minY = lineFunction.m * x + lineFunction.b;
        return y >= minY;
      }
    });

    return lineUninterrupted;
  }
}