import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  public klinesSubject = new Subject();
  public baseUrl = 'http://127.0.0.1:3000';
  public isInvestmentAlgorithm: boolean;
  public twitterUser = environment.twitterUser;

  // general
  public exchange = 'binance'; // binance, alpaca or kucoin; binance spot: BTCUSDT, kucoin futures: XBTUSDTM, alpaca: SPY
  public algorithm = 'meanReversion';
  public symbol = 'BTCUSDT';
  public timeframe = '1d';  // 1m, 5m, 15m, 1h... 1d...
  public times = 100;  // 1 = 1000 timeframes
  public commission = 0.04;

  // algorithms
  public rsiLength = 7;
  public emaPeriodOpen = 80;
  public emaPeriodClose = 80;
  public emaPeriodSL = 80;
  public bbPeriod = 21;
  public momentumStreak = 5;
  public meanReversionThreshold = 0.15;
  public meanReversionProfitBasedTrailingStopLoss  = 0.3;

  // multi
  public isMulti = true;
  public multiAutoParams = false;
  public multiRank = 1;

  constructor() {
    this.checkIsInvestmentAlgorithm();
  }

  private checkIsInvestmentAlgorithm() {
    const investmentStrategies = ['dca', 'meanReversion'];
    this.isInvestmentAlgorithm = investmentStrategies.includes(this.algorithm);
  }
}
