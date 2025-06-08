import { Component } from '@angular/core';
import { forkJoin } from 'rxjs';
import { HttpService } from './http.service';
import { Kline, Run } from './interfaces';
import { ChartService } from './chart.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: false
})
export class AppComponent {
  public klines: Run[];
  public tickers: Run[][];

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
    this.httpService.getKlines().subscribe((klines: Kline[]) => {
      const params = [
        { commission: 0 },
        { commission: this.chartService.commission }
      ];

      const requests = params.map(param => this.httpService.postBacktest(klines, param.commission));

      forkJoin(requests).subscribe((klinesList: Kline[][]) => {
        this.chartService.setLoadingText();

        this.klines = params.map((param: any, i: number) => {
          return {
            klines: klinesList[i],
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
    this.httpService.getMulti().subscribe((tickers: Kline[][]) => {
      this.chartService.setLoadingText();

      const tickersMapped: Run[][] = tickers.map((klines: Kline[]) => {
        return [{
          klines,
          commission: 0
        }];
      });

      tickersMapped.sort((a: Run[], b: Run[]) => {
        return (a[0].klines.at(-1)?.algorithms[this.chartService.algorithms[0]]!.percentProfit || 0) - (b[0].klines.at(-1)?.algorithms[this.chartService.algorithms[0]]!.percentProfit || 0);
      });

      this.tickers = tickersMapped;
    }, (err) => {
      this.chartService.setErrorText(err);
    });
  }
}
