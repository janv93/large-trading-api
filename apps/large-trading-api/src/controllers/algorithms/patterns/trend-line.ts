import Base from '../../../base';
import { Bar, PivotPoint, PivotPointSide, Slope, TrendLine, TrendLinePosition } from '@shared';
import { LinearFunction } from '@shared';

export default class TrendLineController extends Base {
  private readonly bufferPercentage = 0.2;

  /**
   * add trend lines to bars that connect uninterrupted highs/lows
   * difference to addTrendLinesFromPivotPoints: buffers are defined by slope of the trend line instead of simply horizontal (0)
   */
  public addTrendLines(bars: Bar[], minLength: number, maxLength: number, againstTrend: boolean, rightBuffer: boolean): void {
    this.forEachWithProgress(bars, (startBar, i) => {
      const startLow: number = startBar.prices.low;
      const startHigh: number = startBar.prices.high;
      let minSlopeBelow: number = Infinity;
      let maxSlopeAbove: number = -Infinity;
      const endIndex: number = Math.min(i + maxLength, bars.length);

      for (let j = i + 1; j < endIndex; j++) {
        const endBar: Bar = bars[j];
        const endBarLow: number = endBar.prices.low;
        const endBarHigh: number = endBar.prices.high;
        const dx: number = j - i;
        const slopeBelow: number = (endBarLow - startLow) / dx;
        const slopeAbove: number = (endBarHigh - startHigh) / dx;
        const isTrendLineLongEnough: boolean = dx >= minLength;

        if (isTrendLineLongEnough) {
          const isValidBelow: boolean = slopeBelow <= minSlopeBelow && (!againstTrend || this.isTrendLineAgainstTrend(startLow, endBarLow, TrendLinePosition.Below));
          const isValidAbove: boolean = slopeAbove >= maxSlopeAbove && (!againstTrend || this.isTrendLineAgainstTrend(startHigh, endBarHigh, TrendLinePosition.Above));

          const candidates: [boolean, number, number, TrendLinePosition][] = [
            [isValidBelow, startLow, endBarLow, TrendLinePosition.Below],
            [isValidAbove, startHigh, endBarHigh, TrendLinePosition.Above],
          ];

          candidates.forEach(([isValid, startPrice, endPrice, position]) => {
            if (!isValid) return;
            const linearFunction: LinearFunction = new LinearFunction(i, startPrice, j, endPrice);

            if (this.areBuffersUninterrupted(bars, i, j, position, linearFunction, rightBuffer)) {
              startBar.chart = startBar.chart || {};
              startBar.chart.trendLines = startBar.chart.trendLines || [];

              startBar.chart.trendLines.push({
                function: linearFunction,
                startIndex: i,
                endIndex: j,
                length: dx,
                slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
                position,
                againstTrend: this.isTrendLineAgainstTrend(startPrice, endPrice, position)
              });
            }
          });
        }

        minSlopeBelow = Math.min(minSlopeBelow, slopeBelow);
        maxSlopeAbove = Math.max(maxSlopeAbove, slopeAbove);
      }
    });
  }

  // add trend lines to bars that connect uninterrupted pivot points
  public addTrendLinesFromPivotPoints(bars: Bar[], minLength: number, maxLength: number, againstTrend: boolean, rightBuffer: boolean): void {
    this.forEachWithProgress(bars, (startBar, i) => {
      if (!startBar.chart?.pivotPoint) return;  // if no pivot point, skip bar

      const ppStart: PivotPoint = startBar.chart.pivotPoint;
      const ppStartSide: PivotPointSide = ppStart.side;
      const isHigh: boolean = ppStartSide === PivotPointSide.High;
      const startPrice: number = isHigh ? startBar.prices.high : startBar.prices.low;
      const position: TrendLinePosition = isHigh ? TrendLinePosition.Above : TrendLinePosition.Below;
      const endIndex: number = Math.min(i + maxLength, bars.length);
      let extremeSlope: number = isHigh ? -Infinity : Infinity;

      for (let j = i + 1; j < endIndex; j++) {
        const endBar: Bar = bars[j];
        const dx: number = j - i;
        const endPrice: number = isHigh ? endBar.prices.high : endBar.prices.low;
        const currentSlope: number = (endPrice - startPrice) / dx;
        const isTrendLineLongEnough: boolean = dx >= minLength;

        if (isTrendLineLongEnough) {
          const hasPivotPoint: boolean = endBar.chart?.pivotPoint?.side === ppStartSide;
          const isUninterrupted: boolean = isHigh ? currentSlope >= extremeSlope : currentSlope <= extremeSlope;

          if (hasPivotPoint && isUninterrupted && (!againstTrend || this.isTrendLineAgainstTrend(startPrice, endPrice, position))) {
            const linearFunction: LinearFunction = new LinearFunction(i, startPrice, j, endPrice);

            if (this.areBuffersUninterrupted(bars, i, j, position, linearFunction, rightBuffer)) {
              startBar.chart!.trendLines = startBar.chart!.trendLines || [];
              startBar.chart!.trendLines.push({
                function: linearFunction,
                startIndex: i,
                endIndex: j,
                length: dx,
                slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
                position,
                againstTrend: this.isTrendLineAgainstTrend(startPrice, endPrice, position)
              });
            }
          }
        }

        extremeSlope = isHigh ? Math.max(extremeSlope, currentSlope) : Math.min(extremeSlope, currentSlope);
      }
    });
  }

  // extends trend lines until they break through the price, marking a pivotal point
  public addTrendLineBreakthroughs(bars: Bar[], rightBuffer: boolean) {
    bars.forEach((bar: Bar) => {
      const trendLines: TrendLine[] | undefined = bar.chart?.trendLines;

      if (trendLines?.length) {
        trendLines.forEach((trendLine: TrendLine) => {
          this.extendTrendLineUntilBreakthrough(bars, trendLine, rightBuffer);
        });
      }
    });
  }

  public filterTrendLinesWithoutBreakthroughs(bars: Bar[]) {
    bars.forEach((bar: Bar) => {
      if (bar.chart?.trendLines) {
        bar.chart.trendLines = bar.chart.trendLines.filter((trendLine: TrendLine) => trendLine.breakThroughIndex !== undefined);
      }
    });
  }

  private extendTrendLineUntilBreakthrough(bars: Bar[], trendLine: TrendLine, rightBuffer: boolean) {
    const lineFunction: LinearFunction = trendLine.function;
    const position: TrendLinePosition = trendLine.position;
    const buffer: number = rightBuffer ? Math.round(trendLine.length * this.bufferPercentage) : 0;
    const startIndex: number = trendLine.endIndex + 1 + buffer;
    const maxIndex: number = trendLine.endIndex + trendLine.length; // the max distance of the end of the trend line to the breakthrough point, after that it is considered too far away to belong to the line
    const candidateBars: Bar[] = bars.slice(startIndex, maxIndex);
    let breakThroughIndex = -1;

    if (position === TrendLinePosition.Above) {
      breakThroughIndex = candidateBars.findIndex((bar: Bar, i: number) => {
        const currentIndex: number = startIndex + i;
        const currentLinePrice = lineFunction.getY(currentIndex);
        const high = bar.prices.high;
        return high > currentLinePrice;
      });
    } else if (position === TrendLinePosition.Below) {
      breakThroughIndex = candidateBars.findIndex((bar: Bar, i: number) => {
        const currentIndex: number = startIndex + i;
        const currentLinePrice = lineFunction.getY(currentIndex);
        const low = bar.prices.low;
        return low < currentLinePrice;
      });
    }

    const breakThroughBar: Bar | undefined = candidateBars[breakThroughIndex!];

    if (breakThroughIndex > -1) {
      // initialize properties if not yet defined
      breakThroughBar.chart = breakThroughBar.chart || {};
      breakThroughBar.chart!.trendLineBreakthroughs = breakThroughBar.chart?.trendLineBreakthroughs || [];

      // add the trend line which is breaking through the bar to this bar. this reference may then later be used to get the trend line for backtesting purposes
      breakThroughBar.chart.trendLineBreakthroughs.push(trendLine);

      // equally add reference to breakthough point to trend line
      trendLine.breakThroughIndex = startIndex + breakThroughIndex;
    }
  }

  private areBuffersUninterrupted(bars: Bar[], startIndex: number, endIndex: number, position: TrendLinePosition, linearFunction: LinearFunction, rightBuffer: boolean): boolean {
    const length: number = endIndex - startIndex;
    const buffer: number = Math.round(length * this.bufferPercentage);
    const crosses = (k: Bar, x: number) => position === TrendLinePosition.Above ? k.prices.high > linearFunction.getY(x) : k.prices.low < linearFunction.getY(x);
    const leftUninterrupted: boolean = bars.slice(Math.max(0, startIndex - buffer + 1), startIndex).every((k, i, arr) => !crosses(k, startIndex - (arr.length - i)));
    const rightUninterrupted: boolean = !rightBuffer || bars.slice(endIndex + 1, Math.min(bars.length, endIndex + 1 + buffer)).every((k, i) => !crosses(k, endIndex + 1 + i));
    return leftUninterrupted && rightUninterrupted;
  }

  // if trend line is on opposite side of trend (e.g. trend is up, line is below price)
  private isTrendLineAgainstTrend(startPrice: number, endPrice: number, position: TrendLinePosition): boolean {
    const slope: Slope = startPrice < endPrice ? Slope.Ascending : Slope.Descending;
    return (slope === Slope.Ascending && position === TrendLinePosition.Below) ||
      (slope === Slope.Descending && position === TrendLinePosition.Above);
  }
}