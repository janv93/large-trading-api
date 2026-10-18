import { MarketStructureStats, PivotPointSide } from './shared.interfaces';

export interface MarketStructureState {
  lastProcessedIndex?: number;
  swings?: MarketStructureSwing[];
  trend?: MarketStructureStats;
  reversalLevel?: MarketStructureLevel;
}

export interface MarketStructureSwing extends MarketStructureLevel {
  space: number;
  trend?: MarketStructureStats;
}

export interface MarketStructureLevel {
  index: number;
  price: number;
  side: PivotPointSide;
}
