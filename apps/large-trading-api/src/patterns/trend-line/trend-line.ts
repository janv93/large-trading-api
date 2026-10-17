import {
  Bar,
  LinearFunction,
  PivotPoint,
  PivotPointSide,
  roundToSignificantDigits,
  Slope,
  TrendLine,
  TrendLinePosition,
  TrendLinesFromPivotPointsStartEntry,
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

    this.processRightBufferPending(bars, state, i);
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

  /** Uses closed bars only, because a pivot is known only once the bars to its right have closed. */
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
    // a repeated tick brings no new closed bar, and processing the same bar again would recreate lines broken in the meantime
    if (i < 0 || i === state.lastProcessedIndex) return;

    state.lastProcessedIndex = i;
    const lastClosedIndex: number = bars.length - 2;
    const pivotPoint: PivotPoint | undefined = bars[i].chart?.pivotPoint;

    this.processRightBufferPending(bars, state, lastClosedIndex);
    state.candidateTrendLines = state.candidateTrendLines.filter((candidate) => i - candidate.startIndex <= maxLength);

    for (const candidate of state.candidateTrendLines) {
      const position: TrendLinePosition = candidate.side === PivotPointSide.High ? TrendLinePosition.Above : TrendLinePosition.Below;
      const isSlopeUpdated: boolean = this.updatePivotSlope(bars, candidate, i, position);
      if (!isSlopeUpdated || i - candidate.startIndex < minLength || pivotPoint?.side !== candidate.side) continue;

      const trendLine: TrendLine = this.createTrendLine(bars, candidate.startIndex, i, position);
      if (this.isTrendLineAccepted(bars, trendLine, againstTrend)) this.addPivotTrendLine(bars, state, trendLine, rightBuffer);
    }

    if (pivotPoint) {
      const extremeSlope: number = pivotPoint.side === PivotPointSide.High ? -Infinity : Infinity;
      state.candidateTrendLines.push({ startIndex: i, side: pivotPoint.side, extremeSlope });
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
    const slope: number = this.calcSlope(bars, candidate.startIndex, bars.length - 1, position);

    if (position === TrendLinePosition.Below) {
      if (slope > candidate.minSlopeBelow) return false;
      candidate.minSlopeBelow = slope;
    } else {
      if (slope < candidate.maxSlopeAbove) return false;
      candidate.maxSlopeAbove = slope;
    }

    return true;
  }

  // same rule as updateSlope, for a pivot that only tracks its own side
  private updatePivotSlope(
    bars: Bar[],
    candidate: TrendLinesFromPivotPointsStartEntry,
    endIndex: number,
    position: TrendLinePosition,
  ): boolean {
    const slope: number = this.calcSlope(bars, candidate.startIndex, endIndex, position);
    const isSlopeUpdated: boolean =
      position === TrendLinePosition.Above ? slope >= candidate.extremeSlope : slope <= candidate.extremeSlope;
    if (isSlopeUpdated) candidate.extremeSlope = slope;
    return isSlopeUpdated;
  }

  private calcSlope(bars: Bar[], startIndex: number, endIndex: number, position: TrendLinePosition): number {
    const startPrice: number = this.getPrice(bars[startIndex], position);
    const endPrice: number = this.getPrice(bars[endIndex], position);
    return roundToSignificantDigits((endPrice - startPrice) / (endIndex - startIndex), 10);
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

  // a pivot line ends in the past, so part of its right buffer may already have closed
  private addPivotTrendLine(bars: Bar[], state: TrendLinesFromPivotPointsStepState, trendLine: TrendLine, rightBuffer: boolean): void {
    const hasRightBuffer: boolean = rightBuffer && Math.round(trendLine.length * this.bufferPercentage) > 0;
    if (hasRightBuffer && !this.isRightBufferCleared(bars, trendLine, bars.length - 2)) return;

    if (!hasRightBuffer || this.isRightBufferClosed(bars, trendLine)) {
      this.confirmTrendLine(bars, state, trendLine);
    } else {
      state.pendingTrendLines!.push(trendLine);
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

  private isRightBufferCleared(bars: Bar[], trendLine: TrendLine, lastIndex: number): boolean {
    const bufferEnd: number = trendLine.endIndex + Math.round(trendLine.length * this.bufferPercentage);

    for (let index = trendLine.endIndex + 1; index <= Math.min(lastIndex, bufferEnd); index++) {
      if (this.crossesTrendLine(bars, trendLine, index)) return false;
    }

    return true;
  }

  private isRightBufferClosed(bars: Bar[], trendLine: TrendLine): boolean {
    const bufferEnd: number = trendLine.endIndex + Math.round(trendLine.length * this.bufferPercentage);
    return bars.length - 2 >= bufferEnd;
  }

  private removeTrendLine(bars: Bar[], trendLine: TrendLine): void {
    const chart = bars[trendLine.startIndex]?.chart;
    if (!chart?.trendLines) return;
    chart.trendLines = chart.trendLines.filter((existing) => !this.isSameTrendLine(existing, trendLine));
  }

  // lastIndex is the newest bar allowed to drop a line
  private processRightBufferPending(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState, lastIndex: number): void {
    if (!state.pendingTrendLines?.length) return;

    state.pendingTrendLines = state.pendingTrendLines.filter((trendLine) => {
      if (!this.isRightBufferCleared(bars, trendLine, lastIndex)) return false;
      if (!this.isRightBufferClosed(bars, trendLine)) return true;

      this.confirmTrendLine(bars, state, trendLine);
      return false;
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
