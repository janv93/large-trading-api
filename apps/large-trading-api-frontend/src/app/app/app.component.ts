import { Component, computed, signal } from '@angular/core';
import { Run } from '@shared';
import { finalize } from 'rxjs';
import { HttpService } from '../http.service';
import { ChartConfig, copyChartConfig, isMultiConfig, loadChartConfig, saveChartConfig } from '../chart-config/chart-config';
import { LoadingService } from '../loader/loading.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false
})
export class AppComponent {
  public readonly tickers = signal<Run[][]>([]);
  public readonly commissionChecked = signal(false);
  public readonly positionSizeChecked = signal(false);
  public readonly chartingChecked = signal(true);
  public readonly indicatorsChecked = signal(true);
  public readonly backtestRunning = signal(false);
  public readonly activeConfig = signal(loadChartConfig());
  public readonly isMulti = computed(() => isMultiConfig(this.activeConfig()));

  public readonly pageSize = 50;
  public readonly currentPage = signal(0);
  public readonly totalPages = computed(() => Math.ceil(this.tickers().length / this.pageSize));
  public readonly pagedTickers = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.tickers().slice(start, start + this.pageSize);
  });
  public prevPage(): void {
    this.currentPage.update(page => Math.max(0, page - 1));
  }

  public nextPage(): void {
    this.currentPage.update(page => Math.min(this.totalPages() - 1, page + 1));
  }

  constructor(
    public loadingService: LoadingService,
    private httpService: HttpService
  ) {
    this.runBacktest(this.activeConfig());
  }

  public runBacktest(config: ChartConfig): void {
    if (this.backtestRunning()) return;

    const activeConfig = copyChartConfig(config);
    this.backtestRunning.set(true);
    this.tickers.set([]);
    this.currentPage.set(0);
    this.activeConfig.set(activeConfig);

    this.httpService.backtest(activeConfig).pipe(
      finalize(() => this.backtestRunning.set(false))
    ).subscribe({
      next: (runs: Run[]) => {
        this.tickers.update(tickers => [...tickers, runs]);
      },
      error: (err) => {
        this.loadingService.setErrorText(err);
      },
      complete: () => {
        if (!this.tickers().length) {
          this.loadingService.setErrorText('No data received');
          return;
        }
        if (isMultiConfig(activeConfig)) {
          this.tickers.update(tickers => [...tickers].sort((a: Run[], b: Run[]) => {
            return (a[0].bars.at(-1)?.backtests[activeConfig.mainStrategy.strategy]!.profit || 0) - (b[0].bars.at(-1)?.backtests[activeConfig.mainStrategy.strategy]!.profit || 0);
          }));
        }
        saveChartConfig(activeConfig);
        this.loadingService.setLoadingText();
      }
    });
  }
}
