import { Bar, Direction, PivotPoint } from './shared.interfaces';

export interface MarketStructureState {
  lastProcessedIndex?: number;
  swingCandidate?: MarketStructurePivot;
  lastSwingHigh?: MarketStructurePivot;
  lastSwingLow?: MarketStructurePivot;
  direction?: Direction;
  streak?: number;
  isReversed?: boolean;
}

export interface MarketStructurePivot {
  bar: Bar;
  index: number;
  pivotPoint: PivotPoint;
}
