import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  public klinesSubject = new Subject();
  public exchange = 'binance'; // binance, alpaca or kucoin; binance: spot - BTCUSDT, kucoin: futures - XBTUSDTM, alpaca: SPY
  public strategy = 'twitterSentiment';
  public symbol = 'BTCUSDT';
  public timeframe = '1m';  // 1m, 5m, 15m, 1h... 1d...
  public timeframeMultiplier = 10;  // 1 = 1000 timeframes
  public isInvestmentStrategy: boolean;
  public rsiLength = 7;
  public emaPeriodOpen = 80;
  public emaPeriodClose = 80;
  public emaPeriodSL = 80;
  public bbPeriod = 21;
  public momentumStreak = 5;
  public martingaleThreshold = 0.01;
  public twitterUser = environment.twitterUser;
  public commission = 0.04;
  public baseUrl = 'http://127.0.0.1:3000';

  constructor() {
    this.checkIsInvestmentStrategy();
  }

  public createUrl(baseUrl: string, queryObj: any): string {
    let url = baseUrl;
    let firstParam = true;

    Object.keys(queryObj).forEach(param => {
      const query = param + '=' + queryObj[param];
      firstParam ? url += '?' : url += '&';
      url += query;
      firstParam = false;
    });

    return url;
  }

  private checkIsInvestmentStrategy() {
    const investmentStrategies = ['dca', 'martingale'];
    this.isInvestmentStrategy = investmentStrategies.includes(this.strategy);
  }
}
