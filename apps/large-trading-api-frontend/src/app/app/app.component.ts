import { Component, computed, signal } from '@angular/core';
import { Run } from '@shared';
import { HttpService } from '../http.service';
import { ChartService } from '../chart.service';
import { LoadingService } from '../loader/loading.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false
})
export class AppComponent {
  public readonly tickers = signal<Run[][]>([]);
  public readonly multiCommissionChecked = signal(false);

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
    public chartService: ChartService,
    public loadingService: LoadingService,
    private httpService: HttpService
  ) {
    this.httpService.backtest().subscribe({
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
        if (this.chartService.isMulti) {
          this.tickers.update(tickers => [...tickers].sort((a: Run[], b: Run[]) => {
            return (a[0].bars.at(-1)?.algorithms[this.chartService.mainAlgorithm.algorithm]!.profit || 0) - (b[0].bars.at(-1)?.algorithms[this.chartService.mainAlgorithm.algorithm]!.profit || 0);
          }));
        }
        this.loadingService.setLoadingText();
      }
    });
  }
}
