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
      algorithms: [this.getAlgorithmBody(0)]
    };

    if (this.chartService.algorithms.length > 1) body.algorithms.push(this.getAlgorithmBody(1));
    const url = this.baseUrl + '/klinesWithAlgorithm';
    return this.http.post<Kline[]>(url, body);
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

  public getMulti(): Observable<Kline[][]> {
    const { timeframe, multiRank, multiAutoParams } = this.chartService;

    const body = {
      timeframe,
      rank: multiRank,
      autoParams: multiAutoParams,
      algorithms: [this.getAlgorithmBody(0)]
    };

    if (this.chartService.algorithms.length > 1) body.algorithms.push(this.getAlgorithmBody(1));
    const url = this.baseUrl + '/multi';
    return this.http.post<Kline[][]>(url, body);
  }

  private getAlgorithmBody(index: number): any {
    const algorithm = this.chartService.algorithms[index];

    switch (algorithm) {
      case 'momentum':
        return {
          algorithm,
          streak: this.chartService.momentumStreak[index]
        };
      case 'macd':
        return {
          algorithm,
          fast: 12,
          slow: 26,
          signal: 9
        };
      case 'rsi':
        return {
          algorithm,
          length: this.chartService.rsiLength[index]
        };
      case 'ema':
        return {
          algorithm,
          periodOpen: this.chartService.emaPeriodOpen[index],
          periodClose: this.chartService.emaPeriodClose[index]
        };
      case 'emasl':
        return {
          algorithm,
          period: this.chartService.emaPeriodSL[index]
        };
      case 'bb':
        return {
          algorithm,
          period: this.chartService.bbPeriod[index]
        };
      case 'deepTrend':
        return {
          algorithm
        };
      case 'dca':
        return {
          algorithm
        };
      case 'meanReversion':
        return {
          algorithm,
          threshold: this.chartService.meanReversionThreshold[index],
          profitBasedTrailingStopLoss: this.chartService.meanReversionProfitBasedTrailingStopLoss[index]
        };
      case 'flashCrash':
        return {
          algorithm
        };
      case 'twitterSentiment':
        return {
          algorithm
        };
      case 'trendline':
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
