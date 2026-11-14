import { MarketStructureStats, PivotPointSide } from './shared.interfaces';

export interface MarketStructureState {
  lastClosedIndex?: number;
  candidateSwing?: MarketStructureSwing;
  swings?: MarketStructureSwing[];
  trend?: MarketStructureStats;
  reversalLevel?: MarketStructureSwing;
}

export interface MarketStructureSwing {
  index: number;
  price: number;
  side: PivotPointSide;
  trend?: MarketStructureStats;
}
