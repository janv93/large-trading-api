import { Bar, TrendLine, TrendLinePosition, TrendLineStartEntry, TrendLineStepState } from '@shared';
import TrendLineBase from './trend-line-base';

export default class TrendLineController extends TrendLineBase {
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

    this.updatePendingTrendLines(bars, state, i);
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

  // a later live tick can cross a line that an earlier tick of the same bar created
  private removeCrossedCurrentBarTrendLines(bars: Bar[], state: TrendLineStepState): void {
    const i: number = bars.length - 1;
    const isCrossed = (trendLine: TrendLine): boolean => trendLine.endIndex === i && this.isPriceCrossingTrendLine(bars, trendLine, i);
    state.pendingTrendLines = state.pendingTrendLines!.filter((trendLine) => !isCrossed(trendLine));

    state.confirmedTrendLines = state.confirmedTrendLines!.filter((trendLine) => {
      if (!isCrossed(trendLine)) return true;
      this.removeTrendLine(bars, trendLine);
      return false;
    });
  }

  private updateCandidateTrendLines(bars: Bar[], state: TrendLineStepState, maxLength: number): void {
    const i: number = bars.length - 1;

    if (i > 0 && !this.hasCandidateTrendLine(state, i - 1)) {
      state.candidateTrendLines!.push({ startIndex: i - 1, minSlopeBelow: Infinity, maxSlopeAbove: -Infinity });
    }

    state.candidateTrendLines = state.candidateTrendLines!.filter((candidate) => i - candidate.startIndex <= maxLength);
  }

  private updateSlope(bars: Bar[], candidate: TrendLineStartEntry, position: TrendLinePosition): boolean {
    const extremeSlope: number = position === TrendLinePosition.Below ? candidate.minSlopeBelow : candidate.maxSlopeAbove;
    const slope: number = this.calcSlope(bars, candidate.startIndex, bars.length - 1, position);
    if (!this.isSlopeAtLeastAsExtreme(slope, extremeSlope, position)) return false;

    if (position === TrendLinePosition.Below) candidate.minSlopeBelow = slope;
    else candidate.maxSlopeAbove = slope;
    return true;
  }

  private addTrendLine(bars: Bar[], state: TrendLineStepState, trendLine: TrendLine, rightBuffer: boolean): void {
    if (rightBuffer && Math.round(trendLine.length * this.bufferPercentage) > 0) {
      if (!this.hasPendingTrendLine(state, trendLine)) state.pendingTrendLines!.push(trendLine);
    } else {
      this.confirmTrendLine(bars, state, trendLine);
    }
  }

  private hasCandidateTrendLine(state: TrendLineStepState, startIndex: number): boolean {
    return state.candidateTrendLines!.some((entry) => entry.startIndex === startIndex);
  }

  private hasPendingTrendLine(state: TrendLineStepState, trendLine: TrendLine): boolean {
    return state.pendingTrendLines!.some((existing) => this.isSameTrendLine(existing, trendLine));
  }
}
