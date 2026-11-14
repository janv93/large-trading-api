import { MarketStructureStats } from './shared.interfaces';

export interface MarketStructureState {
  lastClosedIndex?: number;
  highIndex?: number;
  lowIndex?: number;
  pivotTrend?: MarketStructureStats;
  trend?: MarketStructureStats;
  reversalIndex?: number;
}
