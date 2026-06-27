import { Injectable } from '@angular/core';
import { Algorithm, Exchange, ExchangeSymbol, Timeframe } from '@shared';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  // general
  public timeframe = Timeframe._1Hour;
  public times = 10;  // 1 = 1000 timeframes
  public commission = 0.0004; // 1 = 100%
  public algorithms = [Algorithm.TrendLineBreakthrough];  // [0] is primary, [1] is optional second algorithm of which only the profit curve will be shown

  public autoSymbols = false;  // true = auto-determine by rank, false = use symbols list
  public symbols: ExchangeSymbol[] = [{ exchange: Exchange.Binance, symbol: 'BTCUSDT' }];
  public rank = 15;
  public autoParams = [false, false];  // primary algorithm and optional second algorithm, determines if algo parameters are auto or fixed

  get isMulti(): boolean { return this.autoSymbols || this.symbols.length !== 1; }

  // loading screen
  public loading = true;
  public loadingText: string;
  public loadingTextInfo: string;
  public isError = false;

  constructor() { }

  public setLoadingText(loadingText?: string, loadingTextInfo?: string) {
    if (!loadingText && !loadingTextInfo) this.loading = false;
    this.isError = false;
    this.loadingText = loadingText!;
    this.loadingTextInfo = loadingTextInfo!;
  }

  public setErrorText(error: any) {
    this.isError = true;
    this.loadingText = `Received error`;
    this.loadingTextInfo = error.error?.error || (typeof error.error === 'string' ? error.error : null) || error.message || error;
  }
}
