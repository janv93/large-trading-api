import {
  Bar,
  PivotPoint,
  PivotPointSide,
  TrendLine,
  TrendLinePosition,
  TrendLinesFromPivotPointsStartEntry,
  TrendLinesFromPivotPointsStepState,
} from '@shared';
import TrendLineBase from './trend-line-base';

export default class PivotTrendLineController extends TrendLineBase {
  public stepTrendLines(
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

    this.updatePendingTrendLines(bars, state, lastClosedIndex);
    state.candidateTrendLines = state.candidateTrendLines.filter((candidate) => i - candidate.startIndex <= maxLength);

    for (const candidate of state.candidateTrendLines) {
      const position: TrendLinePosition = candidate.side === PivotPointSide.High ? TrendLinePosition.Above : TrendLinePosition.Below;
      const isSlopeUpdated: boolean = this.updateSlope(bars, candidate, i, position);
      if (!isSlopeUpdated || i - candidate.startIndex < minLength || pivotPoint?.side !== candidate.side) continue;

      const trendLine: TrendLine = this.createTrendLine(bars, candidate.startIndex, i, position);
      if (this.isTrendLineAccepted(bars, trendLine, againstTrend)) this.addTrendLine(bars, state, trendLine, rightBuffer);
    }

    if (pivotPoint) {
      const extremeSlope: number = pivotPoint.side === PivotPointSide.High ? -Infinity : Infinity;
      state.candidateTrendLines.push({ startIndex: i, side: pivotPoint.side, extremeSlope });
    }
  }

  private updateSlope(bars: Bar[], candidate: TrendLinesFromPivotPointsStartEntry, endIndex: number, position: TrendLinePosition): boolean {
    const slope: number = this.calcSlope(bars, candidate.startIndex, endIndex, position);
    const isSlopeUpdated: boolean =
      position === TrendLinePosition.Above ? slope >= candidate.extremeSlope : slope <= candidate.extremeSlope;
    if (isSlopeUpdated) candidate.extremeSlope = slope;
    return isSlopeUpdated;
  }

  private addTrendLine(bars: Bar[], state: TrendLinesFromPivotPointsStepState, trendLine: TrendLine, rightBuffer: boolean): void {
    const hasRightBuffer: boolean = rightBuffer && Math.round(trendLine.length * this.bufferPercentage) > 0;
    if (hasRightBuffer && !this.isRightBufferCleared(bars, trendLine, bars.length - 2)) return;

    if (!hasRightBuffer || this.isRightBufferClosed(bars, trendLine)) {
      this.confirmTrendLine(bars, state, trendLine);
    } else {
      state.pendingTrendLines!.push(trendLine);
    }
  }
}
