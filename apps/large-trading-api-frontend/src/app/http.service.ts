import { Injectable } from '@angular/core';
import { ChartService } from './chart.service';
import { Observable } from 'rxjs';
import { Run } from '@shared';
import { StrategyConfigs } from './strategy-configs';
import { LoadingService } from './loader/loading.service';


@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private baseUrl = 'http://127.0.0.1:3000';

  constructor(
    private chartService: ChartService,
    private loadingService: LoadingService
  ) { }

  public backtest(): Observable<Run[]> {
    const { autoSymbols, symbols, rank, timeframe, times, commission } = this.chartService;

    const body = {
      timeframe,
      times,
      commission,
      autoSymbols,
      ...(autoSymbols ? { rank } : { symbols }),
      strategies: this.chartService.strategies.map(({ strategy, autoParams }) => {
        const strategyConfig = StrategyConfigs[strategy];
        return { strategy, autoParams, config: autoParams ? strategyConfig?.autoParams : strategyConfig?.default };
      })
    };

    const url = this.baseUrl + '/backtest';
    this.loadingService.setLoadingText('Fetching backtest', '/backtest');

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
              if (line.trim()) observer.next(JSON.parse(line));
            }
          }

          if (buffer.trim()) observer.next(JSON.parse(buffer));
          observer.complete();
        } catch (err: any) {
          if (err?.name !== 'AbortError') observer.error(err);
        }
      })();

      return () => controller.abort();
    });
  }

}
