import { Injectable, NgZone } from '@angular/core';
import { ChartService } from './chart.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Algorithm, Kline } from '@shared';
import { AlgorithmConfigs } from './algorithm-configs';


@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private baseUrl = 'http://127.0.0.1:3000';

  constructor(
    private chartService: ChartService,
    private http: HttpClient,
    private ngZone: NgZone
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

  public getMultiStream(): Observable<Kline[]> {
    const { timeframe, times, multiRank, multiAutoParams, multiCommission } = this.chartService;

    const body = {
      timeframe,
      times,
      commission: multiCommission,
      rank: multiRank,
      autoParams: multiAutoParams,
      algorithms: this.chartService.algorithms.map((a, i) => this.getAlgorithmBody(i))
    };

    const url = this.baseUrl + '/multi';
    this.chartService.setLoadingText(`Getting multiple tickers with backtests`, '/multi');

    return new Observable<Kline[]>(observer => {
      const controller = new AbortController();

      (async () => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const decoder = new TextDecoder();
          let buffer = '';

          for await (const chunk of response.body as any) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop()!;

            for (const line of lines) {
              if (line.trim()) this.ngZone.run(() => observer.next(JSON.parse(line)));
            }
          }

          if (buffer.trim()) this.ngZone.run(() => observer.next(JSON.parse(buffer)));
          this.ngZone.run(() => observer.complete());
        } catch (err: any) {
          if (err?.name !== 'AbortError') this.ngZone.run(() => observer.error(err));
        }
      })();

      return () => controller.abort();
    });
  }

  private getAlgorithmBody(index: number): any {
    const algorithm: Algorithm = this.chartService.algorithms[index];
    const algorithmConfig = AlgorithmConfigs[algorithm];
    const isAutoParams = this.chartService.multiAutoParams[index];
    return { algorithm, ...(isAutoParams ? algorithmConfig?.multi : algorithmConfig?.single) };
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
