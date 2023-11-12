import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  public klinesSubject = new Subject();
  public baseUrl = 'http://127.0.0.1:3000';
  public twitterUser = environment.twitterUser;

  // general
  public exchange = 'alpaca'; // binance, alpaca or kucoin; binance spot: BTCUSDT, kucoin futures: XBTUSDTM, alpaca: SPY
  public symbol = 'AI';
  public timeframe = '1h';  // 1m, 5m, 15m, 1h... 1d...
  public times = 10;  // 1 = 1000 timeframes
  public commission = 0.04;

  // algorithm, [0] is primary, [1] is optional second algorithm
  public algorithms = ['meanReversion', 'dca']; // if second algorithm is set, will draw a second profit line for comparison
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
  public multiAutoParams = [false, false];  // primary algorithm and optional second algorithm
  public multiRank = 30;

  constructor() { }
}
