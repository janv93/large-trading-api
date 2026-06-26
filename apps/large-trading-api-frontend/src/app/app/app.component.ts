import { Component } from '@angular/core';
import { Run } from '@shared';
import { HttpService } from '../http.service';
import { ChartService } from '../chart.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false
})
export class AppComponent {
  public tickers: Run[][];
  public multiCommissionChecked = false;

  public readonly pageSize = 50;
  public currentPage = 0;

  get totalPages(): number {
    return this.tickers ? Math.ceil(this.tickers.length / this.pageSize) : 0;
  }

  get pagedTickers(): Run[][] {
    if (!this.tickers) return [];
    const start = this.currentPage * this.pageSize;
    return this.tickers.slice(start, start + this.pageSize);
  }

  public prevPage(): void {
    if (this.currentPage > 0) this.currentPage--;
  }

  public nextPage(): void {
    if (this.currentPage < this.totalPages - 1) this.currentPage++;
  }

  constructor(
    public chartService: ChartService,
    private httpService: HttpService
  ) {
    this.tickers = [];

    this.httpService.backtest().subscribe({
      next: (runs: Run[]) => {
        this.tickers.push(runs);
      },
      error: (err) => {
        this.chartService.setErrorText(err);
      },
      complete: () => {
        if (!this.tickers.length) {
          this.chartService.setErrorText('No data received');
          return;
        }
        if (this.chartService.isMulti) {
          this.tickers.sort((a: Run[], b: Run[]) => {
            return (a[0].bars.at(-1)?.algorithms[this.chartService.algorithms[0]]!.profit || 0) - (b[0].bars.at(-1)?.algorithms[this.chartService.algorithms[0]]!.profit || 0);
          });
        }
        this.chartService.setLoadingText();
      }
    });
  }
}
