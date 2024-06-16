import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Algorithm, Exchange, Timeframe } from './interfaces';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  public klinesSubject = new Subject();
  public baseUrl = 'http://127.0.0.1:3000';

  // general
  public exchange = Exchange.Binance;
  public symbol = 'BTCUSDT';  // ignored for multi
  public timeframe = Timeframe._1Day;
  public times = 10;  // 1 = 1000 timeframes
  public commission = 0.04;

  // algorithm, [0] is primary, [1] is optional second algorithm of which only the profit curve will be shown
  public algorithms = [Algorithm.TrendLine, Algorithm.Dca]; // if second algorithm is set, will draw a second profit line for comparison
  public rsiLength = [7, 7];
  public emaPeriodOpen = [80, 80];
  public emaPeriodClose = [80, 80];
  public emaPeriodSL = [80, 80];
  public bbPeriod = [21, 21];
  public momentumStreak = [5, 5];
  public meanReversionThreshold = [0.15, 0.15];
  public meanReversionProfitBasedTrailingStopLoss = [0.3, 0.3];

  // multi
  public isMulti = true;
  public multiAutoParams = [false, false];  // primary algorithm and optional second algorithm, determines if algo parameters are chosen automatically or from this service
  public multiRank = 15;  // top {rank} tickers of each category. e.g. top 10 of stocks, cryptos etc

  // loading
  public loading = true;
  public loadingText: string;
  public loadingTextInfo: string;

  constructor() { }

  public setLoadingText(loadingText?: string, loadingTextInfo?: string) {
    if (!loadingText && !loadingTextInfo) this.loading = false;
    this.loadingText = loadingText!;
    this.loadingTextInfo = loadingTextInfo!;
  }

  public setErrorText(error: any) {
    this.loadingText = `Received error`;
    this.loadingTextInfo = error.error?.error || error.error || error.message;
  }
}
