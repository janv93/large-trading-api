import { SignalReference } from './shared.interfaces';

export interface BacktesterState {
  positions?: BacktesterPosition[];
  profit?: number;
  volatility?: number;
}

export interface BacktesterPosition {
  closed: boolean;
  size: number; // current size, changing - positive means long, negative short
  entrySize: number; // size at entry, does not change
  price: number;
  entryPrice: number;
  highestPrice?: number; // optional because we can't evaluate intra bar if the high was reached after the entryPrice
  lowestPrice?: number; // as above
  liquidationPrice: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  openSignalReference: SignalReference;
  closeSignalReference?: SignalReference;
}
