import { PivotPointSide, TrendLine } from './shared.interfaces';

export interface TrendLineStepState {
  candidateTrendLines?: TrendLineStartEntry[];
  confirmedTrendLines?: TrendLine[];
  pendingTrendLines?: TrendLine[];
}

export interface TrendLineStartEntry {
  startIndex: number;
  minSlopeBelow: number;
  maxSlopeAbove: number;
}

export interface TrendLinesFromPivotPointsStepState {
  candidateTrendLines?: TrendLinesFromPivotPointsStartEntry[];
  confirmedTrendLines?: TrendLine[];
  pendingTrendLines?: TrendLine[];
}

export interface TrendLinesFromPivotPointsStartEntry {
  startIndex: number;
  side: PivotPointSide;
  extremeSlope: number;
}
