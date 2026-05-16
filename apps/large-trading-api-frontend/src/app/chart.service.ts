import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Algorithm, Exchange, Timeframe } from '@shared';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  public klinesSubject = new Subject();
  public baseUrl = 'http://127.0.0.1:3000';

  // general
  public exchange = Exchange.Binance;  // ignored for multi
  public symbol = 'BTCUSDT';  // ignored for multi
  public timeframe = Timeframe._1Hour;
  public times = 1;  // 1 = 1000 timeframes
  public commission = 0.04; // 0.04%
  public algorithms = [Algorithm.TrendLineBreakthrough];  // [0] is primary, [1] is optional second algorithm of which only the profit curve will be shown

  // multi
  public isMulti = true; // multiple charts mode
  public multiAutoParams = [true, false];  // primary algorithm and optional second algorithm, determines if algo parameters are single or multi
  public multiRank = 15;  // top <multiRank> tickers of each category. e.g. top 10 of stocks, cryptos etc
  public multiCommission = 0.00;

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
