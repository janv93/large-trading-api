import { ExchangeSymbol, Strategy, StrategyConfigMulti, Timeframe } from '../shared.interfaces';

export interface ChartConfig {
  timeframe: Timeframe;
  times: number;
  commission: number;
  strategy: Strategy;
  autoParams: boolean;
  symbols: ExchangeSymbol[];
  autoSymbols: boolean;
  rank: number;
}

export interface StrategyConfig {
  default: Record<string, any>;
  autoParams?: Record<string, StrategyConfigMulti>;
}