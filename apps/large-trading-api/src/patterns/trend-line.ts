import Base from '../base';
import { Bar, PivotPoint, PivotPointSide, Slope, TrendLine, TrendLinePosition, TrendLinesFromPivotPointsStepState, TrendLineStepState } from '@shared';
import { LinearFunction } from '@shared';

export default class TrendLineController extends Base {
  private readonly bufferPercentage = 0.2;
  private readonly breakthroughMaxLengthFactor = 1;

  /**
   * add trend lines to bars that connect uninterrupted highs/lows
   * difference to addTrendLinesFromPivotPoints: buffers are defined by slope of the trend line instead of simply horizontal (0)
   */
  public stepTrendLines(bars: Bar[], state: TrendLineStepState, minLength: number, maxLength: number, againstTrend: boolean, rightBuffer: boolean): void {
    state.candidateTrendLines ??= [];
    state.confirmedTrendLines ??= [];
    state.pendingTrendLines ??= [];

    const i: number = bars.length - 1;

    this.processRightBufferPending(bars, state);
    state.candidateTrendLines = state.candidateTrendLines.filter(entry => i - entry.startIndex <= maxLength);

    for (const entry of state.candidateTrendLines) {
      const startIdx: number = entry.startIndex;
      const dx: number = i - startIdx;

      const startLow: number = bars[startIdx].prices.low;
      const startHigh: number = bars[startIdx].prices.high;
      const endLow: number = bars[i].prices.low;
      const endHigh: number = bars[i].prices.high;
      const slopeBelow: number = (endLow - startLow) / dx;
      const slopeAbove: number = (endHigh - startHigh) / dx;

      if (dx >= minLength) {
        const isValidBelow: boolean = slopeBelow <= entry.minSlopeBelow && (!againstTrend || this.isTrendLineAgainstTrend(startLow, endLow, TrendLinePosition.Below));
        const isValidAbove: boolean = slopeAbove >= entry.maxSlopeAbove && (!againstTrend || this.isTrendLineAgainstTrend(startHigh, endHigh, TrendLinePosition.Above));

        const candidates: [boolean, number, number, TrendLinePosition][] = [
          [isValidBelow, startLow, endLow, TrendLinePosition.Below],
          [isValidAbove, startHigh, endHigh, TrendLinePosition.Above],
        ];

        candidates.forEach(([isValid, startPrice, endPrice, position]) => {
          if (!isValid) return;
          const linearFunction: LinearFunction = new LinearFunction(startIdx, startPrice, i, endPrice);

          if (this.isLeftBufferUninterrupted(bars, startIdx, i, position, linearFunction)) {
            const trendLine: TrendLine = {
              function: linearFunction,
              startIndex: startIdx,
              endIndex: i,
              length: dx,
              slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
              position,
              againstTrend: this.isTrendLineAgainstTrend(startPrice, endPrice, position)
            };
            if (rightBuffer && Math.round(dx * this.bufferPercentage) > 0) {
              state.pendingTrendLines!.push(trendLine);
            } else {
              this.confirmTrendLine(bars, state, trendLine);
            }
          }
        });
      }

      // update after the check so that i is not included in the check at this step
      entry.minSlopeBelow = Math.min(entry.minSlopeBelow, slopeBelow);
      entry.maxSlopeAbove = Math.max(entry.maxSlopeAbove, slopeAbove);
    }

    state.candidateTrendLines.push({ startIndex: i, minSlopeBelow: Infinity, maxSlopeAbove: -Infinity });
  }

  /** runs `space` bars behind the live bar, because a pivot point is only known once `space` bars have confirmed it */
  public stepTrendLinesFromPivotPoints(bars: Bar[], state: TrendLinesFromPivotPointsStepState, space: number, minLength: number, maxLength: number, againstTrend: boolean, rightBuffer: boolean): void {
    state.candidateTrendLines ??= [];
    state.confirmedTrendLines ??= [];
    state.pendingTrendLines ??= [];

    const i: number = bars.length - 1 - space;
    if (i < 0) return;

    const endBar: Bar = bars[i];
    const ppEnd: PivotPoint | undefined = endBar.chart?.pivotPoint;

    this.processRightBufferPending(bars, state);
    state.candidateTrendLines = state.candidateTrendLines.filter(entry => i - entry.startIndex <= maxLength);

    for (const entry of state.candidateTrendLines) {
      const startIdx: number = entry.startIndex;
      const { side, extremeSlope } = entry;
      const dx: number = i - startIdx;

      const isHigh: boolean = side === PivotPointSide.High;
      const startBar: Bar = bars[startIdx];
      const startPrice: number = isHigh ? startBar.prices.high : startBar.prices.low;
      const endPrice: number = isHigh ? endBar.prices.high : endBar.prices.low;
      const currentSlope: number = (endPrice - startPrice) / dx;

      if (dx >= minLength && ppEnd?.side === side) {
        const position: TrendLinePosition = isHigh ? TrendLinePosition.Above : TrendLinePosition.Below;
        const isUninterrupted: boolean = isHigh ? currentSlope >= extremeSlope : currentSlope <= extremeSlope;

        if (isUninterrupted && (!againstTrend || this.isTrendLineAgainstTrend(startPrice, endPrice, position))) {
          const linearFunction: LinearFunction = new LinearFunction(startIdx, startPrice, i, endPrice);

          if (this.isLeftBufferUninterrupted(bars, startIdx, i, position, linearFunction)) {
            const trendLine: TrendLine = {
              function: linearFunction,
              startIndex: startIdx,
              endIndex: i,
              length: dx,
              slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
              position,
              againstTrend: this.isTrendLineAgainstTrend(startPrice, endPrice, position)
            };
            if (rightBuffer && Math.round(dx * this.bufferPercentage) > 0) {
              this.catchUpRightBuffer(bars, state, trendLine);
            } else {
              this.confirmTrendLine(bars, state, trendLine);
            }
          }
        }
      }

      // update after the check so that i is not included in the check at this step
      entry.extremeSlope = isHigh
        ? Math.max(extremeSlope, currentSlope)
        : Math.min(extremeSlope, currentSlope);
    }

    if (ppEnd) {
      const isHigh: boolean = ppEnd.side === PivotPointSide.High;
      state.candidateTrendLines.push({ startIndex: i, side: ppEnd.side, extremeSlope: isHigh ? -Infinity : Infinity });
    }
  }

  public stepTrendLineBreakthroughs(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState, rightBuffer: boolean): void {
    state.confirmedTrendLines ??= [];
    const i: number = bars.length - 1;

    state.confirmedTrendLines = state.confirmedTrendLines.filter(trendLine => {
      if (trendLine.breakThroughIndex !== undefined) return false;
      if (i < trendLine.endIndex + Math.round(trendLine.length * this.breakthroughMaxLengthFactor)) return true;
      this.removeTrendLine(bars, trendLine); // it ran out of room to break through, so it never will
      return false;
    });

    for (const trendLine of state.confirmedTrendLines) {
      const buffer: number = rightBuffer ? Math.round(trendLine.length * this.bufferPercentage) : 0;
      const rangeStart: number = trendLine.endIndex + 1 + buffer;

      if (i < rangeStart) continue;

      if (this.crossesTrendLine(bars, trendLine, i)) {
        bars[i].chart = bars[i].chart || {};
        bars[i].chart.trendLineBreakthroughs = bars[i].chart.trendLineBreakthroughs || [];
        bars[i].chart.trendLineBreakthroughs.push(trendLine);
        trendLine.breakThroughIndex = i;
      }
    }
  }

  private crossesTrendLine(bars: Bar[], trendLine: TrendLine, index: number): boolean {
    const linePrice: number = trendLine.function.getY(index);
    return trendLine.position === TrendLinePosition.Above
      ? bars[index].prices.high > linePrice
      : bars[index].prices.low < linePrice;
  }

  private confirmTrendLine(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState, trendLine: TrendLine): void {
    const startBar: Bar = bars[trendLine.startIndex];
    startBar.chart = startBar.chart || {};
    startBar.chart.trendLines = startBar.chart.trendLines || [];
    startBar.chart.trendLines.push(trendLine);
    state.confirmedTrendLines!.push(trendLine);
  }

  /** the line is built once its end pivot is confirmed, so part of its right buffer has already elapsed and can be checked immediately */
  private catchUpRightBuffer(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState, trendLine: TrendLine): void {
    const bufferEnd: number = trendLine.endIndex + Math.round(trendLine.length * this.bufferPercentage);
    const live: number = bars.length - 1;

    for (let j = trendLine.endIndex + 1; j <= Math.min(live, bufferEnd); j++) {
      if (this.crossesTrendLine(bars, trendLine, j)) return;
    }

    if (live >= bufferEnd) this.confirmTrendLine(bars, state, trendLine);
    else state.pendingTrendLines!.push(trendLine);
  }

  private removeTrendLine(bars: Bar[], trendLine: TrendLine): void {
    const chart = bars[trendLine.startIndex]?.chart;
    if (!chart?.trendLines) return;
    chart.trendLines = chart.trendLines.filter(t => t !== trendLine);
  }

  private processRightBufferPending(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState): void {
    if (!state.pendingTrendLines?.length) return;
    const i = bars.length - 1;
    state.pendingTrendLines = state.pendingTrendLines.filter(trendLine => {
      const buffer = Math.round(trendLine.length * this.bufferPercentage);
      if (this.crossesTrendLine(bars, trendLine, i)) return false;
      if (i >= trendLine.endIndex + buffer) {
        this.confirmTrendLine(bars, state, trendLine);
        return false;
      }
      return true;
    });
  }

  private isLeftBufferUninterrupted(bars: Bar[], startIndex: number, endIndex: number, position: TrendLinePosition, linearFunction: LinearFunction): boolean {
    const length: number = endIndex - startIndex;
    const buffer: number = Math.round(length * this.bufferPercentage);
    const crosses = (k: Bar, x: number) => position === TrendLinePosition.Above ? k.prices.high > linearFunction.getY(x) : k.prices.low < linearFunction.getY(x);
    return bars.slice(Math.max(0, startIndex - buffer + 1), startIndex).every((k, i, arr) => !crosses(k, startIndex - (arr.length - i)));
  }

  // if trend line is on opposite side of trend (e.g. trend is up, line is below price)
  private isTrendLineAgainstTrend(startPrice: number, endPrice: number, position: TrendLinePosition): boolean {
    const slope: Slope = startPrice < endPrice ? Slope.Ascending : Slope.Descending;
    return (slope === Slope.Ascending && position === TrendLinePosition.Below) ||
      (slope === Slope.Descending && position === TrendLinePosition.Above);
  }
}