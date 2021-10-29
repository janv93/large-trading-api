import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  public klinesSubject = new Subject();
  public exchange = 'binance';
  public symbol = 'BTCUSDT';
  public timeframe = '1h';
  public timeframeMultiplier = 3;  // 1 = 1 * 1000 timeframes
  public strategy = 'ema';
  public rsiLength = 7;
  public emaPeriod = 80;
  public bbPeriod = 21;
  public commission = 0.04;
  public baseUrl = 'http://127.0.0.1:3000';

  constructor() {
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
}
