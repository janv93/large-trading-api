import { Component } from '@angular/core';
import { forkJoin } from 'rxjs';
import { HttpService } from '../http.service';
import { Bar, Run } from '@shared';
import { ChartService } from '../chart.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false
})
export class AppComponent {
  public bars: Run[];
  public tickers: Run[][];

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
    if (this.chartService.isMulti) {
      this.backtestMulti();
    } else {
      this.backtestSingle();
    }
  }

  private backtestSingle() {
    this.httpService.getBars().subscribe((bars: Bar[]) => {
      if (bars?.length === 0) {
        this.chartService.setErrorText(`No bars received for symbol ${this.chartService.symbol}`);
        return;
      }

      const params = [
        { commission: 0 },
        { commission: this.chartService.commission }
      ];

      const requests = params.map(param => this.httpService.postBacktest(bars, param.commission));

      forkJoin(requests).subscribe((barsList: Bar[][]) => {
        this.chartService.setLoadingText();

        this.bars = params.map((param: any, i: number) => {
          return {
            bars: barsList[i],
            commission: param.commission
          };
        });
      }, (err) => {
        this.chartService.setErrorText(err);
      });
    }, (err) => {
      this.chartService.setErrorText(err);
    });
  }

  private backtestMulti() {
    this.tickers = [];

    this.httpService.getMultiStream().subscribe({
      next: (bars: Bar[]) => {
        this.tickers.push([{ bars, commission: 0 }]);
      },
      error: (err) => {
        this.chartService.setErrorText(err);
      },
      complete: () => {
        this.tickers.sort((a: Run[], b: Run[]) => {
          return (a[0].bars.at(-1)?.algorithms[this.chartService.algorithms[0]]!.profit || 0) - (b[0].bars.at(-1)?.algorithms[this.chartService.algorithms[0]]!.profit || 0);
        });
        this.chartService.setLoadingText();
      }
    });
  }
}
