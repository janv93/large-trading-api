import Base from '../../../base';
import { Kline, PivotPoint, PivotPointSide, Slope, TrendLine, TrendLinePosition } from '../../../interfaces';
import { LinearFunction } from './linear-function';

export default class Charting extends Base {
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

  // add trend lines to klines that connect uninterrupted highs/lows
  public addTrendLines(klines: Kline[], minLength: number, maxLength: number): void {
    for (let i = 0; i < klines.length; i++) {
      const startKline: Kline = klines[i];
      const startLow: number = startKline.prices.low;
      const startHigh: number = startKline.prices.high;
      const klinesInRange: Kline[] = klines.slice(i + minLength, i + maxLength);

      if (!klinesInRange.length) continue;

      klinesInRange.forEach((endKline: Kline, j: number) => {
        const endIndex: number = i + minLength + j;
        const endLow: number = endKline.prices.low;
        const endHigh: number = endKline.prices.high;
        const lineFunctionBelow: LinearFunction = new LinearFunction(i, startLow, endIndex, endLow);
        const lineFunctionAbove: LinearFunction = new LinearFunction(i, startHigh, endIndex, endHigh);

        const trendLineBelow: TrendLine = {
          function: lineFunctionBelow,
          startIndex: i,
          endIndex,
          length: endIndex - i,
          slope: lineFunctionBelow.m > 0 ? Slope.Ascending : Slope.Descending,
          position: TrendLinePosition.Below,
          againstTrend: this.isTrendLineAgainstTrend(startLow, endLow, TrendLinePosition.Below)
        };

        const trendLineAbove: TrendLine = {
          function: lineFunctionAbove,
          startIndex: i,
          endIndex,
          length: endIndex - i,
          slope: lineFunctionAbove.m > 0 ? Slope.Ascending : Slope.Descending,
          position: TrendLinePosition.Above,
          againstTrend: this.isTrendLineAgainstTrend(startHigh, endHigh, TrendLinePosition.Above)
        };

        const validBelow: boolean = this.isValidTrendLine(klines, trendLineBelow);
        const validAbove: boolean = this.isValidTrendLine(klines, trendLineAbove);

        if (validBelow) {
          startKline.chart = startKline.chart || {};
          startKline.chart.trendLines = startKline.chart.trendLines || [];
          startKline.chart.trendLines.push(trendLineBelow);
        } else if (validAbove) {
          startKline.chart = startKline.chart || {};
          startKline.chart.trendLines = startKline.chart.trendLines || [];
          startKline.chart.trendLines.push(trendLineAbove);
        }
      });
    }
  }

  // add trend lines to klines that connect uninterrupted pivot points
  public addTrendLinesFromPivotPoints(klines: Kline[], minLength: number, maxLength: number): void {
    for (let i = 0; i < klines.length; i++) {
      const kline: Kline = klines[i];

      if (!kline.chart?.pivotPoints?.length) continue;  // if no pivot points, skip kline

      const ppStart: PivotPoint = kline.chart.pivotPoints[0];
      const ppStartSide: PivotPointSide = ppStart.side
      const ppStartPrice: number = ppStartSide === PivotPointSide.High ? kline.prices.high : kline.prices.low;
      const klinesInRange: Kline[] = klines.slice(i + minLength, i + maxLength);

      if (!klinesInRange.length) continue;

      klinesInRange.forEach((k: Kline, j: number) => {
        const endIndex: number = i + minLength + j;
        const ppEnd: PivotPoint | undefined = k.chart?.pivotPoints?.[0];
        const isSameSide: boolean = ppEnd?.side === ppStartSide;

        if (ppEnd && isSameSide) {
          const ppEndPrice: number = ppStartSide === PivotPointSide.High ? k.prices.high : k.prices.low;
          const lineFunction: LinearFunction = new LinearFunction(i, ppStartPrice, endIndex, ppEndPrice);
          const position: TrendLinePosition = ppStartSide === PivotPointSide.High ? TrendLinePosition.Above : TrendLinePosition.Below;

          const trendLine: TrendLine = {
            function: lineFunction,
            startIndex: i,
            endIndex,
            length: endIndex - i,
            slope: lineFunction.m > 0 ? Slope.Ascending : Slope.Descending,
            position,
            againstTrend: this.isTrendLineAgainstTrend(ppStartPrice, ppEndPrice, position)
          };

          const valid: boolean = this.isValidTrendLine(klines, trendLine);

          if (valid) {
            kline.chart!.trendLines = kline.chart!.trendLines || [];
            kline.chart!.trendLines.push(trendLine);
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

  public filterTrendLinesWithoutBreakthroughs(klines: Kline[]) {
    klines.forEach((kline: Kline) => {
      if (kline.chart?.trendLines) {
        kline.chart.trendLines = kline.chart.trendLines.filter((trendLine: TrendLine) => trendLine.breakThroughIndex !== undefined);
      }
    });
  }

  private extendTrendLineUntilBreakthrough(klines: Kline[], trendLine: TrendLine) {
    const lineFunction = trendLine.function;
    const position: TrendLinePosition = trendLine.position;
    const startIndex: number = trendLine.endIndex + 1;
    const maxIndex: number = trendLine.endIndex + trendLine.length * 2; // the max distance of the end of the trend line to the breakthrough point, after that it is considered too far away to belong to the line
    const candidateKlines: Kline[] = klines.slice(startIndex, maxIndex);
    let breakThroughIndex = -1;

    if (position === TrendLinePosition.Above) {
      breakThroughIndex = candidateKlines.findIndex((kline: Kline, i: number) => {
        const currentIndex: number = startIndex + i;
        const currentLinePrice = lineFunction.getY(currentIndex);
        const high = kline.prices.high;
        return high > currentLinePrice;
      });
    } else if (position === TrendLinePosition.Below) {
      breakThroughIndex = candidateKlines.findIndex((kline: Kline, i: number) => {
        const currentIndex: number = startIndex + i;
        const currentLinePrice = lineFunction.getY(currentIndex);
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

  private isValidTrendLine(klines: Kline[], trendLine: TrendLine): boolean {
    const startIndex: number = trendLine.startIndex;
    const endIndex: number = trendLine.endIndex;
    const uninterrupted = this.isTrendLineUninterrupted(klines, trendLine);
    const length = trendLine.length;
    const leftBuffer = Math.round(length * 0.2);  // some buffer to the left of the start of the line
    const leftBufferTrendLine: TrendLine = this.clone(trendLine);
    leftBufferTrendLine.startIndex = startIndex - leftBuffer;
    leftBufferTrendLine.endIndex = startIndex;
    const leftBufferUninterrupted = this.isTrendLineUninterrupted(klines, leftBufferTrendLine); // make sure line extends uninterrupted to the left beyond the start, similar to how a pivot point must have some left klines to be valid
    const rightBuffer = Math.round(length * 0.2); // same logic to the right
    const rightBufferTrendLine: TrendLine = this.clone(trendLine);
    rightBufferTrendLine.startIndex = endIndex;
    rightBufferTrendLine.endIndex = endIndex + rightBuffer;
    const rightBufferUninterrupted = this.isTrendLineUninterrupted(klines, rightBufferTrendLine);
    return uninterrupted && leftBufferUninterrupted && rightBufferUninterrupted && trendLine.againstTrend;
  }

  // checks if trend line from A to B has no klines in between that cross the line
  private isTrendLineUninterrupted(klines: Kline[], trendLine: TrendLine): boolean {
    const startIndex: number = trendLine.startIndex;
    const endIndex: number = trendLine.endIndex;
    const trendLineCloses: number[] = klines.slice(startIndex, endIndex).map(kline => kline.prices.close);
    const averagePriceChange: number = this.calcAverageChangeInPercent(trendLineCloses);

    const lineUninterrupted = klines.slice(startIndex + 1, endIndex).every((kline: Kline, i: number) => {
      const x: number = startIndex + 1 + i;

      if (trendLine.position === TrendLinePosition.Above) {
        const y: number = kline.prices.high;
        const maxY: number = trendLine.function.m * x + trendLine.function.b;
        return y <= maxY * (1 + averagePriceChange * 0.00);
      } else {
        const y: number = kline.prices.low;
        const minY: number = trendLine.function.m * x + trendLine.function.b;
        return y >= minY * (1 - averagePriceChange * 0.00);
      }
    });

    return lineUninterrupted;
  }

  // if trend line is on opposite side of trend (e.g. trend is up, line is below price)
  private isTrendLineAgainstTrend(startPrice: number, endPrice: number, position: TrendLinePosition): boolean {
    const slope: Slope = startPrice < endPrice ? Slope.Ascending : Slope.Descending;
    return (slope === Slope.Ascending && position === TrendLinePosition.Below) ||
      (slope === Slope.Descending && position === TrendLinePosition.Above);
  }
}