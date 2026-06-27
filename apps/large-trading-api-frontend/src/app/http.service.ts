import { Injectable, NgZone } from '@angular/core';
import { ChartService } from './chart.service';
import { Observable } from 'rxjs';
import { Run } from '@shared';
import { AlgorithmConfigs } from './algorithm-configs';


@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private baseUrl = 'http://127.0.0.1:3000';

  constructor(
    private chartService: ChartService,
    private ngZone: NgZone
  ) { }

  public backtest(): Observable<Run[]> {
    const { autoSymbols, symbols, rank, timeframe, times, commission, autoParams } = this.chartService;

    const body = {
      timeframe,
      times,
      commission,
      autoParams,
      ...(autoSymbols ? { rank } : { symbols }),
      algorithms: this.chartService.algorithms.map((a, i) => this.getAlgorithmBody(i))
    };

    const url = this.baseUrl + '/backtest';
    this.chartService.setLoadingText('Fetching backtest', '/backtest');

    return new Observable<Run[]>(observer => {
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
    const algorithm = this.chartService.algorithms[index];
    const algorithmConfig = AlgorithmConfigs[algorithm];
    const isAutoParams = this.chartService.autoParams[index];
    return { algorithm, ...(isAutoParams ? algorithmConfig?.autoParams : algorithmConfig?.default) };
  }
}
