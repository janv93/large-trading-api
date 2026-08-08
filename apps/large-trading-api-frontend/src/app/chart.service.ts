import { Injectable } from '@angular/core';
import { Algorithm, Exchange, ExchangeSymbol, Timeframe } from '@shared';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  public timeframe = Timeframe._1Hour;
  public times = 1;  // 1 = 1000 timeframes
  public commission = 0.0004; // 1 = 100%
  public algorithms = [{ algorithm: Algorithm.Example, autoParams: false }];  // [0] is primary, [1] is optional second algorithm of which only the profit curve will be shown
  public autoSymbols = false;  // true = auto-determine by rank, false = use symbols list below
  public symbols: ExchangeSymbol[] = [{ exchange: Exchange.Binance, symbol: 'BTCUSDT' }];
  public rank = 15;

  get isMulti(): boolean { return this.autoSymbols || this.symbols.length !== 1; }
}
