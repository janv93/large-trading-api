import Base from '../../../base';
import { Kline, PivotPoint, PivotPointSide, Slope, TrendLine, TrendLinePosition } from '../../../interfaces';
import { LinearFunction } from './linear-function';

export default class TrendLineController extends Base {
  /**
   * add trend lines to klines that connect uninterrupted highs/lows
   * difference to addTrendLinesFromPivotPoints: buffers are defined by slope of the trend line instead of simply horizontal (0)
   */
  public addTrendLines(klines: Kline[], minLength: number, maxLength: number): void {
    this.forEachWithProgress(klines, (startKline, i) => {
      const startLow: number = startKline.prices.low;
      const startHigh: number = startKline.prices.high;
      let minSlopeBelow: number = Infinity;
      let maxSlopeAbove: number = -Infinity;
      const endIndex: number = Math.min(i + maxLength, klines.length);

      for (let j = i + 1; j < endIndex; j++) {
        const endKline: Kline = klines[j];
        const endKlineLow: number = endKline.prices.low;
        const endKlineHigh: number = endKline.prices.high;
        const dx: number = j - i;
        const slopeBelow: number = (endKlineLow - startLow) / dx;
        const slopeAbove: number = (endKlineHigh - startHigh) / dx;
        const isTrendLineLongEnough: boolean = dx >= minLength;

        if (isTrendLineLongEnough) {
          const isValidBelow: boolean = slopeBelow <= minSlopeBelow && this.isTrendLineAgainstTrend(startLow, endKlineLow, TrendLinePosition.Below);
          const isValidAbove: boolean = slopeAbove >= maxSlopeAbove && this.isTrendLineAgainstTrend(startHigh, endKlineHigh, TrendLinePosition.Above);

          const candidates: [boolean, number, number, TrendLinePosition][] = [
            [isValidBelow, startLow, endKlineLow, TrendLinePosition.Below],
            [isValidAbove, startHigh, endKlineHigh, TrendLinePosition.Above],
          ];

          candidates.forEach(([isValid, startPrice, endPrice, position]) => {
            if (!isValid) return;
            const linearFunction: LinearFunction = new LinearFunction(i, startPrice, j, endPrice);

            if (this.areBuffersUninterrupted(klines, i, j, position, linearFunction.m, linearFunction.b)) {
              startKline.chart = startKline.chart || {};
              startKline.chart.trendLines = startKline.chart.trendLines || [];

              startKline.chart.trendLines.push({
                function: linearFunction,
                startIndex: i,
                endIndex: j,
                length: dx,
                slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
                position,
                againstTrend: true
              });
            }
          });
        }

        minSlopeBelow = Math.min(minSlopeBelow, slopeBelow);
        maxSlopeAbove = Math.max(maxSlopeAbove, slopeAbove);
      }
    });
  }

  // add trend lines to klines that connect uninterrupted pivot points
  public addTrendLinesFromPivotPoints(klines: Kline[], minLength: number, maxLength: number): void {
    this.forEachWithProgress(klines, (kline, i) => {
      if (!kline.chart?.pivotPoint) return;  // if no pivot point, skip kline

      const ppStart: PivotPoint = kline.chart.pivotPoint;
      const ppStartSide: PivotPointSide = ppStart.side;
      const isHigh: boolean = ppStartSide === PivotPointSide.High;
      const startPrice: number = isHigh ? kline.prices.high : kline.prices.low;
      const position: TrendLinePosition = isHigh ? TrendLinePosition.Above : TrendLinePosition.Below;
      const endIndex: number = Math.min(i + maxLength, klines.length);
      let extremeSlope: number = isHigh ? -Infinity : Infinity;

      for (let j = i + 1; j < endIndex; j++) {
        const endKline: Kline = klines[j];
        const dx: number = j - i;
        const endPrice: number = isHigh ? endKline.prices.high : endKline.prices.low;
        const currentSlope: number = (endPrice - startPrice) / dx;
        const isTrendLineLongEnough: boolean = dx >= minLength;

        if (isTrendLineLongEnough) {
          const hasPivotPoint: boolean = endKline.chart?.pivotPoint?.side === ppStartSide;
          const isUninterrupted: boolean = isHigh ? currentSlope >= extremeSlope : currentSlope <= extremeSlope;

          if (hasPivotPoint && isUninterrupted && this.isTrendLineAgainstTrend(startPrice, endPrice, position)) {
            const linearFunction: LinearFunction = new LinearFunction(i, startPrice, j, endPrice);

            if (this.areBuffersUninterrupted(klines, i, j, position, linearFunction.m, linearFunction.b)) {
              kline.chart!.trendLines = kline.chart!.trendLines || [];
              kline.chart!.trendLines.push({
                function: linearFunction,
                startIndex: i,
                endIndex: j,
                length: dx,
                slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
                position,
                againstTrend: true
              });
            }
          }
        }

        extremeSlope = isHigh ? Math.max(extremeSlope, currentSlope) : Math.min(extremeSlope, currentSlope);
      }
    });
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
    const maxIndex: number = trendLine.endIndex + trendLine.length * 1; // the max distance of the end of the trend line to the breakthrough point, after that it is considered too far away to belong to the line
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

  private areBuffersUninterrupted(klines: Kline[], startIndex: number, endIndex: number, position: TrendLinePosition, m: number, b: number): boolean {
    const length = endIndex - startIndex;
    const buffer = Math.round(length * 0.2);
    const crosses = (k: Kline, x: number) => position === TrendLinePosition.Above ? k.prices.high > m * x + b : k.prices.low < m * x + b;
    const leftUninterrupted = klines.slice(Math.max(0, startIndex - buffer + 1), startIndex).every((k, i, arr) => !crosses(k, startIndex - (arr.length - i)));
    const rightUninterrupted = klines.slice(endIndex + 1, Math.min(klines.length, endIndex + buffer)).every((k, i) => !crosses(k, endIndex + 1 + i));
    return leftUninterrupted && rightUninterrupted;
  }

  // if trend line is on opposite side of trend (e.g. trend is up, line is below price)
  private isTrendLineAgainstTrend(startPrice: number, endPrice: number, position: TrendLinePosition): boolean {
    const slope: Slope = startPrice < endPrice ? Slope.Ascending : Slope.Descending;
    return (slope === Slope.Ascending && position === TrendLinePosition.Below) ||
      (slope === Slope.Descending && position === TrendLinePosition.Above);
  }
}