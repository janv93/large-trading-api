import { Bar, BarWithIndex, PivotPoint } from './shared.interfaces';

export interface MarketStructureState {
  barsWithPivotPoints?: BarWithIndex[];
  candidate?: MarketStructureCandidate;
}

export interface MarketStructureCandidate {
  bar: Bar;
  index: number;
  pivotPoint: PivotPoint;
}
