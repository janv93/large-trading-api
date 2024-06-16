import { Injectable } from '@angular/core';
import { ChartService } from './chart.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Algorithm, Kline } from './interfaces';


@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private baseUrl = 'http://127.0.0.1:3000';

  constructor(
    private chartService: ChartService,
    private http: HttpClient
  ) { }

  public getKlines(): Observable<Kline[]> {
    const { exchange, symbol, timeframe, times } = this.chartService;

    const body = {
      exchange,
      symbol,
      timeframe,
      times,
      algorithms: this.chartService.algorithms.map((a, i) => this.getAlgorithmBody(i))
    };

    const url = this.baseUrl + '/klinesWithAlgorithm';
    this.chartService.setLoadingText(`Getting klines with signals`, url.replace(this.baseUrl, ''));
    return this.http.post<Kline[]>(url, body);
  }

  public postBacktest(klines: Array<Kline>, commission: number): Observable<Kline[]> {
    const query = {
      commission: commission
    };

    const url = this.baseUrl + '/backtest';
    const urlWithQuery = this.createUrl(url, query);
    this.chartService.setLoadingText(`Getting backtest`, urlWithQuery.replace(this.baseUrl, ''));
    return this.http.post<Kline[]>(urlWithQuery, klines);
  }

  public getMulti(): Observable<Kline[][]> {
    const { timeframe, times, multiRank, multiAutoParams } = this.chartService;

    const body = {
      timeframe,
      times,
      rank: multiRank,
      autoParams: multiAutoParams,
      algorithms: this.chartService.algorithms.map((a, i) => this.getAlgorithmBody(i))
    };

    const url = this.baseUrl + '/multi';
    this.chartService.setLoadingText(`Getting multiple tickers with backtests`, url.replace(this.baseUrl, ''));
    return this.http.post<Kline[][]>(url, body);
  }

  private getAlgorithmBody(index: number): any {
    const algorithm = this.chartService.algorithms[index];

    switch (algorithm) {
      case Algorithm.Momentum:
        return {
          algorithm,
          streak: this.chartService.momentumStreak[index]
        };
      case Algorithm.Macd:
        return {
          algorithm,
          fast: 12,
          slow: 26,
          signal: 9
        };
      case Algorithm.Rsi:
        return {
          algorithm,
          length: this.chartService.rsiLength[index]
        };
      case Algorithm.Ema:
        return {
          algorithm,
          periodOpen: this.chartService.emaPeriodOpen[index],
          periodClose: this.chartService.emaPeriodClose[index]
        };
      case Algorithm.Bb:
        return {
          algorithm,
          period: this.chartService.bbPeriod[index]
        };
      case Algorithm.DeepTrend:
        return {
          algorithm
        };
      case Algorithm.Dca:
        return {
          algorithm
        };
      case Algorithm.MeanReversion:
        return {
          algorithm,
          threshold: this.chartService.meanReversionThreshold[index],
          profitBasedTrailingStopLoss: this.chartService.meanReversionProfitBasedTrailingStopLoss[index]
        };
      case Algorithm.TwitterSentiment:
        return {
          algorithm
        };
      case Algorithm.TrendLine:
        return {
          algorithm
        }
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
