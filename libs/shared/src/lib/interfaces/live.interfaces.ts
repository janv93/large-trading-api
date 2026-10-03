import { Bar, BarPrices, Strategy } from './shared.interfaces';

export interface LiveStrategyEntry {
  strategy: Strategy;
  config: any;
}

export interface LiveWorkerLifecycleOptions {
  strategyInstance: any;
  backtesterInstance: any;
  strategyConfig: any;
  timeframeMs: number;
  commission: number;
}

export interface LiveActiveBar {
  latestTick: LiveStrategyContext;
  observedPrices: BarPrices;
}

export interface LiveStrategyContext {
  bars: Bar[];
  state: LiveStrategyState;
}

export interface LiveStrategyState {
  barDone?: boolean;
  [key: string]: any;
}

export interface LiveLatestPriceResponse {
  price?: number;
  error?: string;
}
