import { BacktesterState } from './backtester.interfaces';
import { Bar, Strategy } from './shared.interfaces';

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

export interface LiveCalculationState {
  window: Bar[];
  strategyState: LiveStrategyState;
  backtesterState: BacktesterState;
}

export interface LiveStrategyState {
  barDone?: boolean;
  [key: string]: any;
}

export interface LiveLatestPriceResponse {
  price?: number;
  error?: string;
}
