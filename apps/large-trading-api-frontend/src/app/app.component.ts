import { Component } from '@angular/core';
import { forkJoin } from 'rxjs';
import { HttpService } from './http.service';
import { Kline, Klines } from './interfaces';
import { ChartService } from './chart.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public klines: Klines[];
  public tickers: Klines[][];

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
        { commission: 0, flowingProfit: false },
        { commission: this.chartService.commission, flowingProfit: false },
        { commission: 0, flowingProfit: true },
        { commission: this.chartService.commission, flowingProfit: true }
      ];

      const requests = params.map(param => {
        return this.httpService.postBacktest(klines, param.commission, param.flowingProfit);
      });

      forkJoin(requests).subscribe((klinesList: Kline[][]) => {
        this.klines = params.map((param: any, i: number) => {
          return {
            klines: klinesList[i],
            commission: param.commission,
            flowingProfit: param.flowingProfit
          };
        });
      });
    });
  }

  private backtestMulti() {
    this.httpService.getMulti().subscribe((tickers: Kline[][]) => {
      const tickersMapped: Klines[][] = tickers.map((klines: Kline[]) => {
        return [{
          klines,
          commission: 0,
          flowingProfit: true
        }];
      });

      tickersMapped.sort((a: Klines[], b: Klines[]) => {
        return (a[0].klines.at(-1)?.algorithms[this.chartService.algorithms[0]].percentProfit || 0) - (b[0].klines.at(-1)?.algorithms[this.chartService.algorithms[0]].percentProfit || 0);
      });

      this.tickers = tickersMapped;
    });
  }
}
