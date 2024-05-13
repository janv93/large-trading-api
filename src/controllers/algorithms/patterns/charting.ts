import { Kline, PivotPoint, PivotPointSide, Slope, TrendLine, TrendLinePosition } from '../../../interfaces';
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

  // add trend lines to klines that connect uninterrupted pivot points
  public addTrendLinesFromPivotPoints(klines: Kline[], minLength: number, maxLength: number): void {
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
          const lineFunction: LinearFunction = new LinearFunction(i, ppStartPrice, endIndex, ppEndPrice);
          const valid: boolean = this.isValidTrendLine(klines, i, endIndex, ppStartPrice, ppEndPrice, ppStartSide, lineFunction);

          if (valid) {
            kline.chart!.trendLines = kline.chart!.trendLines || [];

            kline.chart!.trendLines.push({
              function: lineFunction,
              startIndex: i,
              endIndex: endIndex,
              length: endIndex - i,
              slope: ppStartPrice < ppEndPrice ? Slope.Ascending : Slope.Descending,
              position: ppStartSide === PivotPointSide.High ? TrendLinePosition.Above : TrendLinePosition.Below
            });
          }
        }
      });
    }
  }

  // extends trend lines until they break through the price, marking a pivotal point
  public addTrendLineBreakthroughs(klines: Kline[]) {
    klines.forEach((kline: Kline) => {
      const trendLines: TrendLine[] | undefined = kline.chart?.trendLines;

      if (trendLines?.length) {
        trendLines.forEach((trendLine: TrendLine) => {
          this.extendTrendLineUntilBreakthrough(klines, trendLine);
        });
      }
    });
  }

  private extendTrendLineUntilBreakthrough(klines: Kline[], trendLine: TrendLine) {
    const lineFunction = new LinearFunction(trendLine.function.m, trendLine.function.b);
    const position: TrendLinePosition = trendLine.position;
    const startIndex: number = trendLine.endIndex + 1;
    const maxIndex: number = trendLine.endIndex + trendLine.length * 2; // the max distance of the end of the trend line to the breakthrough point, after that it is considered too far away to belong to the line
    const candidateKlines: Kline[] = klines.slice(startIndex, maxIndex);
    let breakThroughIndex = -1;

    if (position === TrendLinePosition.Above) {
      breakThroughIndex = candidateKlines.findIndex((kline: Kline, i: number) => {
        const currentLinePrice = lineFunction.getY(startIndex + i);
        const high = kline.prices.high;
        return high > currentLinePrice;
      });
    } else if (position === TrendLinePosition.Below) {
      breakThroughIndex = candidateKlines.findIndex((kline: Kline, i: number) => {
        const currentLinePrice = lineFunction.getY(startIndex + i);
        const low = kline.prices.low;
        return low < currentLinePrice;
      });
    }

    const breakThroughKline: Kline | undefined = candidateKlines[breakThroughIndex!];

    if (breakThroughIndex > -1) {
      // initialize properties if not yet defined
      breakThroughKline.chart = breakThroughKline.chart || {};
      breakThroughKline.chart!.trendLineBreakthroughs = breakThroughKline.chart?.trendLineBreakthroughs || [];

      // add the trend line which is breaking through the kline to this kline. this reference may then later be used to get the trend line for backtesting purposes
      breakThroughKline.chart.trendLineBreakthroughs.push(trendLine);

      // equally add reference to breakthough point to trend line
      trendLine.breakThroughIndex = trendLine.endIndex + 1 + breakThroughIndex;
    }
  }

  private isValidTrendLine(klines: Kline[], startIndex: number, endIndex: number, startPrice: number, endPrice: number, side: PivotPointSide, lineFunction: LinearFunction): boolean {
    const uninterrupted = this.trendLineIsUninterrupted(klines, lineFunction, startIndex, endIndex, side);
    const length = endIndex - startIndex;
    const leftBuffer = length * 0.2;  // some buffer to the left of the start of the line
    const leftBufferUninterrupted = this.trendLineIsUninterrupted(klines, lineFunction, startIndex - leftBuffer, startIndex, side); // make sure line extends uninterrupted to the left beyond the start, similar to how a pivot point must have some left klines to be valid
    const rightBuffer = length * 0.1; // same logic to the right
    const rightBufferUninterrupted = this.trendLineIsUninterrupted(klines, lineFunction, endIndex, endIndex + rightBuffer, side);
    const againstTrend = this.trendLineIsAgainstTrend(startPrice, endPrice, side);
    return uninterrupted && leftBufferUninterrupted && rightBufferUninterrupted && againstTrend;
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

  // if trend line is on opposite side of trend (e.g. trend is up, line is below price)
  private trendLineIsAgainstTrend(startPrice: number, endPrice: number, side: PivotPointSide): boolean {
    const slope = startPrice < endPrice ? Slope.Ascending : Slope.Descending;
    const position = side === PivotPointSide.High ? TrendLinePosition.Above : TrendLinePosition.Below;
    return (slope === Slope.Ascending && position === TrendLinePosition.Below) || (slope === Slope.Descending && position === TrendLinePosition.Above);
  }
}