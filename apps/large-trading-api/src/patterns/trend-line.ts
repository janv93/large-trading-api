import {
  Bar,
  LinearFunction,
  PivotPoint,
  PivotPointSide,
  roundToSignificantDigits,
  Slope,
  TrendLine,
  TrendLinePosition,
  TrendLinesFromPivotPointsStepState,
  TrendLineStartEntry,
  TrendLineStepState,
} from '@shared';
import Base from '../base';

export default class TrendLineController extends Base {
  private readonly bufferPercentage = 0.2;
  private readonly breakthroughMaxLengthFactor = 1;

  public stepTrendLines(
    bars: Bar[],
    state: TrendLineStepState,
    minLength: number,
    maxLength: number,
    againstTrend: boolean,
    rightBuffer: boolean,
  ): void {
    state.candidateTrendLines ??= [];
    state.confirmedTrendLines ??= [];
    state.pendingTrendLines ??= [];

    const i: number = bars.length - 1;

    this.processRightBufferPending(bars, state);
    this.removeCrossedCurrentBarTrendLines(bars, state);
    this.updateCandidateTrendLines(bars, state, maxLength);

    for (const candidate of state.candidateTrendLines) {
      for (const position of [TrendLinePosition.Below, TrendLinePosition.Above]) {
        const isSlopeUpdated: boolean = this.updateSlope(bars, candidate, position);
        if (!isSlopeUpdated || i - candidate.startIndex < minLength) continue;

        const trendLine: TrendLine = this.createTrendLine(bars, candidate.startIndex, i, position);
        if (this.isTrendLineAccepted(bars, trendLine, againstTrend)) this.addTrendLine(bars, state, trendLine, rightBuffer);
      }
    }
  }

  /** Uses a pivot only after all bars in its right buffer have closed. */
  public stepTrendLinesFromPivotPoints(
    bars: Bar[],
    state: TrendLinesFromPivotPointsStepState,
    space: number,
    minLength: number,
    maxLength: number,
    againstTrend: boolean,
    rightBuffer: boolean,
  ): void {
    state.candidateTrendLines ??= [];
    state.confirmedTrendLines ??= [];
    state.pendingTrendLines ??= [];

    const i: number = bars.length - 2 - space;
    if (i < 0) return;

    const currentBar: Bar = bars[i];
    const currentPivotPoint: PivotPoint | undefined = currentBar.chart?.pivotPoint;

    this.processRightBufferPending(bars, state);
    state.candidateTrendLines = state.candidateTrendLines.filter((entry) => i - entry.startIndex <= maxLength);

    for (const entry of state.candidateTrendLines) {
      const startIdx: number = entry.startIndex;
      const { side, extremeSlope } = entry;
      const dx: number = i - startIdx;
      if (dx === 0) continue;

      const isHigh: boolean = side === PivotPointSide.High;
      const startBar: Bar = bars[startIdx];
      const startPrice: number = isHigh ? startBar.prices.high : startBar.prices.low;
      const endPrice: number = isHigh ? currentBar.prices.high : currentBar.prices.low;
      const currentSlope: number = roundToSignificantDigits((endPrice - startPrice) / dx, 10);

      if (dx >= minLength && currentPivotPoint?.side === side) {
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
              againstTrend: this.isTrendLineAgainstTrend(startPrice, endPrice, position),
            };
            if (rightBuffer && Math.round(dx * this.bufferPercentage) > 0) {
              if (this.rightBufferCleared(bars, trendLine)) {
                const bufferEnd: number = trendLine.endIndex + Math.round(trendLine.length * this.bufferPercentage);
                const live: number = bars.length - 1;

                if (live > bufferEnd) {
                  this.confirmTrendLine(bars, state, trendLine);
                } else if (!this.hasPendingTrendLine(state, trendLine)) state.pendingTrendLines!.push(trendLine);
              }
            } else {
              this.confirmTrendLine(bars, state, trendLine);
            }
          }
        }
      }

      // update after the check so that i is not included in the check at this step
      entry.extremeSlope = isHigh ? Math.max(extremeSlope, currentSlope) : Math.min(extremeSlope, currentSlope);
    }

    if (currentPivotPoint) {
      const isHigh: boolean = currentPivotPoint.side === PivotPointSide.High;

      if (!this.hasCandidateTrendLine(state, i)) {
        state.candidateTrendLines.push({ startIndex: i, side: currentPivotPoint.side, extremeSlope: isHigh ? -Infinity : Infinity });
      }
    }
  }

  public stepTrendLineBreakthroughs(
    bars: Bar[],
    state: TrendLineStepState | TrendLinesFromPivotPointsStepState,
    rightBuffer: boolean,
  ): TrendLine[] {
    state.confirmedTrendLines ??= [];
    const i: number = bars.length - 1;
    const newBreakthroughs: TrendLine[] = [];

    state.confirmedTrendLines = state.confirmedTrendLines.filter((trendLine) => {
      if (trendLine.breakThroughIndex !== undefined) return false;
      if (i < trendLine.endIndex + Math.round(trendLine.length * this.breakthroughMaxLengthFactor)) return true;
      this.removeTrendLine(bars, trendLine); // past the max length for a breakthrough, remove it from the chart
      return false;
    });

    for (const trendLine of state.confirmedTrendLines) {
      const buffer: number = rightBuffer ? Math.round(trendLine.length * this.bufferPercentage) : 0;
      const rangeStart: number = trendLine.endIndex + 1 + buffer;

      if (i < rangeStart) continue;

      if (this.crossesTrendLine(bars, trendLine, i)) {
        bars[i].chart = bars[i].chart || {};
        bars[i].chart.trendLineBreakthroughs = bars[i].chart.trendLineBreakthroughs || [];

        if (!this.hasTrendLineBreakthrough(bars[i], trendLine)) {
          bars[i].chart.trendLineBreakthroughs.push(trendLine);
          newBreakthroughs.push(trendLine);
        }

        trendLine.breakThroughIndex = i;
      }
    }

    return newBreakthroughs;
  }

  // a later tick can cross a line that an earlier tick of the same bar created
  private removeCrossedCurrentBarTrendLines(bars: Bar[], state: TrendLineStepState): void {
    const i: number = bars.length - 1;
    const isCrossed = (trendLine: TrendLine): boolean => trendLine.endIndex === i && this.crossesTrendLine(bars, trendLine, i);
    state.pendingTrendLines = state.pendingTrendLines!.filter((trendLine) => !isCrossed(trendLine));

    state.confirmedTrendLines = state.confirmedTrendLines!.filter((trendLine) => {
      if (!isCrossed(trendLine)) return true;
      this.removeTrendLine(bars, trendLine);
      return false;
    });
  }

  // a line needs two bars, so the latest start is the bar before the current one
  private updateCandidateTrendLines(bars: Bar[], state: TrendLineStepState, maxLength: number): void {
    const i: number = bars.length - 1;

    if (i > 0 && !this.hasCandidateTrendLine(state, i - 1)) {
      state.candidateTrendLines!.push({ startIndex: i - 1, minSlopeBelow: Infinity, maxSlopeAbove: -Infinity });
    }

    state.candidateTrendLines = state.candidateTrendLines!.filter((candidate) => i - candidate.startIndex <= maxLength);
  }

  // the line to the current bar crosses no bar since its start exactly when its slope is the most extreme so far
  private updateSlope(bars: Bar[], candidate: TrendLineStartEntry, position: TrendLinePosition): boolean {
    const i: number = bars.length - 1;
    const startPrice: number = this.getPrice(bars[candidate.startIndex], position);
    const endPrice: number = this.getPrice(bars[i], position);
    const slope: number = roundToSignificantDigits((endPrice - startPrice) / (i - candidate.startIndex), 10);

    if (position === TrendLinePosition.Below) {
      if (slope > candidate.minSlopeBelow) return false;
      candidate.minSlopeBelow = slope;
    } else {
      if (slope < candidate.maxSlopeAbove) return false;
      candidate.maxSlopeAbove = slope;
    }

    return true;
  }

  private createTrendLine(bars: Bar[], startIndex: number, endIndex: number, position: TrendLinePosition): TrendLine {
    const startPrice: number = this.getPrice(bars[startIndex], position);
    const endPrice: number = this.getPrice(bars[endIndex], position);
    const linearFunction: LinearFunction = new LinearFunction(startIndex, startPrice, endIndex, endPrice);

    return {
      function: linearFunction,
      startIndex,
      endIndex,
      length: endIndex - startIndex,
      slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
      position,
      againstTrend: this.isTrendLineAgainstTrend(startPrice, endPrice, position),
    };
  }

  private isTrendLineAccepted(bars: Bar[], trendLine: TrendLine, againstTrend: boolean): boolean {
    if (againstTrend && !trendLine.againstTrend) return false;
    return this.isLeftBufferUninterrupted(bars, trendLine.startIndex, trendLine.endIndex, trendLine.position, trendLine.function);
  }

  private addTrendLine(bars: Bar[], state: TrendLineStepState, trendLine: TrendLine, rightBuffer: boolean): void {
    if (rightBuffer && Math.round(trendLine.length * this.bufferPercentage) > 0) {
      if (!this.hasPendingTrendLine(state, trendLine)) state.pendingTrendLines!.push(trendLine);
    } else {
      this.confirmTrendLine(bars, state, trendLine);
    }
  }

  private getPrice(bar: Bar, position: TrendLinePosition): number {
    return position === TrendLinePosition.Below ? bar.prices.low : bar.prices.high;
  }

  private crossesTrendLine(bars: Bar[], trendLine: TrendLine, index: number): boolean {
    const linePrice: number = trendLine.function.getY(index);
    return trendLine.position === TrendLinePosition.Above ? bars[index].prices.high > linePrice : bars[index].prices.low < linePrice;
  }

  private confirmTrendLine(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState, trendLine: TrendLine): void {
    if (this.hasConfirmedTrendLine(state, trendLine)) return;
    const startBar: Bar = bars[trendLine.startIndex];
    startBar.chart = startBar.chart || {};
    startBar.chart.trendLines = startBar.chart.trendLines || [];
    startBar.chart.trendLines.push(trendLine);
    state.confirmedTrendLines!.push(trendLine);
  }

  private rightBufferCleared(bars: Bar[], trendLine: TrendLine): boolean {
    const bufferEnd: number = trendLine.endIndex + Math.round(trendLine.length * this.bufferPercentage);

    for (let index = trendLine.endIndex + 1; index <= Math.min(bars.length - 1, bufferEnd); index++) {
      if (this.crossesTrendLine(bars, trendLine, index)) return false;
    }

    return true;
  }

  private removeTrendLine(bars: Bar[], trendLine: TrendLine): void {
    const chart = bars[trendLine.startIndex]?.chart;
    if (!chart?.trendLines) return;
    chart.trendLines = chart.trendLines.filter((existing) => !this.isSameTrendLine(existing, trendLine));
  }

  private processRightBufferPending(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState): void {
    if (!state.pendingTrendLines?.length) return;
    const i = bars.length - 1;

    state.pendingTrendLines = state.pendingTrendLines.filter((trendLine) => {
      const bufferEnd: number = trendLine.endIndex + Math.round(trendLine.length * this.bufferPercentage);

      if (i > bufferEnd) {
        this.confirmTrendLine(bars, state, trendLine);
        return false;
      }

      return this.rightBufferCleared(bars, trendLine);
    });
  }

  private hasCandidateTrendLine(state: TrendLineStepState | TrendLinesFromPivotPointsStepState, startIndex: number): boolean {
    return state.candidateTrendLines!.some((entry) => entry.startIndex === startIndex);
  }

  private hasPendingTrendLine(state: TrendLineStepState | TrendLinesFromPivotPointsStepState, trendLine: TrendLine): boolean {
    return state.pendingTrendLines!.some((existing) => this.isSameTrendLine(existing, trendLine));
  }

  private hasConfirmedTrendLine(state: TrendLineStepState | TrendLinesFromPivotPointsStepState, trendLine: TrendLine): boolean {
    return state.confirmedTrendLines!.some((existing) => this.isSameTrendLine(existing, trendLine));
  }

  private hasTrendLineBreakthrough(bar: Bar, trendLine: TrendLine): boolean {
    return bar.chart!.trendLineBreakthroughs!.some((existing) => this.isSameTrendLine(existing, trendLine));
  }

  private isSameTrendLine(first: TrendLine, second: TrendLine): boolean {
    return this.isSameCurrentBarTrendLine(first, second) && first.endIndex === second.endIndex;
  }

  private isSameCurrentBarTrendLine(first: TrendLine, second: TrendLine): boolean {
    return first.startIndex === second.startIndex && first.position === second.position;
  }

  private isLeftBufferUninterrupted(
    bars: Bar[],
    startIndex: number,
    endIndex: number,
    position: TrendLinePosition,
    linearFunction: LinearFunction,
  ): boolean {
    const length: number = endIndex - startIndex;
    const buffer: number = Math.round(length * this.bufferPercentage);
    if (startIndex < buffer) return false;

    const crosses = (k: Bar, x: number) =>
      position === TrendLinePosition.Above ? k.prices.high > linearFunction.getY(x) : k.prices.low < linearFunction.getY(x);
    return bars.slice(startIndex - buffer, startIndex).every((k, i, arr) => !crosses(k, startIndex - (arr.length - i)));
  }

  // if trend line is on opposite side of trend (e.g. trend is up, line is below price)
  private isTrendLineAgainstTrend(startPrice: number, endPrice: number, position: TrendLinePosition): boolean {
    return position === TrendLinePosition.Below ? endPrice > startPrice : endPrice < startPrice;
  }
}
