import { Injectable } from '@angular/core';
import { Algorithm, Exchange, ExchangeSymbol, Timeframe } from '@shared';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  public timeframe = Timeframe._1Hour;
  public times = 1;  // 1 = 1000 timeframes
  public commission = 0.0004; // 1 = 100%
  public mainAlgorithm = { algorithm: Algorithm.Example, autoParams: false };
  public comparisonAlgorithm = null;  // optional, compare profit curve
  public symbols: ExchangeSymbol[] = [{ exchange: Exchange.Binance, symbol: 'BTCUSDT' }];
  public autoSymbols = false;  // true = auto-determine by rank, false = use symbols list below
  public rank = 15;

  get algorithms() { return [this.mainAlgorithm, ...(this.comparisonAlgorithm ? [this.comparisonAlgorithm] : [])]; }
  get isMulti(): boolean { return this.autoSymbols || this.symbols.length !== 1; }
}
