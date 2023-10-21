import { Injectable } from '@angular/core';
import { ChartService } from './chart.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Kline } from './interfaces';


@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private baseUrl = 'http://127.0.0.1:3000';

  constructor(private chartService: ChartService, private http: HttpClient) { }

  public getKlines(): Observable<Kline[]> {
    const query = this.getStrategyQuery();
    const url = this.baseUrl + '/klinesWithAlgorithm';
    const urlWithQuery = this.chartService.createUrl(url, query);
    return this.http.get<Kline[]>(urlWithQuery);
  }

  public postBacktest(klines: Array<Kline>, commission: number, flowingProfit: boolean): Observable<Kline[]> {
    const query = {
      commission: commission,
      flowingProfit: flowingProfit
    };

    const url = this.baseUrl + '/backtest';
    const urlWithQuery = this.createUrl(url, query);
    return this.http.post<Kline[]>(urlWithQuery, klines);
  }

  private getStrategyQuery(): any {
    const { exchange, strategy, symbol, times, timeframe } = this.chartService;

    switch (strategy) {
      case 'pivotReversal':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'pivotReversal',
          leftBars: 4,
          rightBars: 1
        };
      case 'momentum':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'momentum',
          streak: this.chartService.momentumStreak
        };
      case 'macd':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'macd',
          fast: 12,
          slow: 26,
          signal: 9
        };
      case 'rsi':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'rsi',
          length: this.chartService.rsiLength
        };
      case 'ema':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'ema',
          periodOpen: this.chartService.emaPeriodOpen,
          periodClose: this.chartService.emaPeriodClose
        };
      case 'emasl':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'emasl',
          period: this.chartService.emaPeriodSL
        };
      case 'bb':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'bb',
          period: this.chartService.bbPeriod
        };
      case 'deepTrend':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'deepTrend'
        };
      case 'dca':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'dca'
        };
      case 'meanReversion':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'meanReversion',
          threshold: this.chartService.meanReversionThreshold,
          exitMultiplier: this.chartService.meanReversionExitMultiplier
        };
      case 'flashCrash':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'flashCrash'
        };
      case 'twitterSentiment':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'twitterSentiment',
          user: this.chartService.twitterUser
        };
    }
  }

  private createUrl(url: string, queryObj: any): string {
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
