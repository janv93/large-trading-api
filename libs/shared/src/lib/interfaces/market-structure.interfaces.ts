import { Bar, Direction, PivotPoint } from './shared.interfaces';

export interface MarketStructureState {
  lastProcessedIndex?: number;
  swingCandidate?: MarketStructurePivot;
  lastSwingHigh?: MarketStructurePivot;
  lastSwingLow?: MarketStructurePivot;
  direction?: Direction;
  streak?: number;
  protectiveLevel?: MarketStructureProtectiveLevel;
  isReversed?: boolean;
}

export interface MarketStructurePivot {
  bar: Bar;
  index: number;
  pivotPoint: PivotPoint;
}

export interface MarketStructureProtectiveLevel {
  protectedDirection: Direction;
  index: number;
  price: number;
}
