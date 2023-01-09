import { AfterViewInit, Component, ElementRef, ViewChild, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';
import { ChartService } from '../chart.service';
import { BinanceKline } from '../interfaces';
import { BaseComponent } from '../base-component';

@Component({
  selector: 'profit-chart',
  templateUrl: './profit-chart.component.html',
  styleUrls: ['./profit-chart.component.scss']
})
export class ProfitChartComponent extends BaseComponent implements AfterViewInit {
  @ViewChild('apexChart')
  public apexChart: ElementRef;

  @Input()
  public commission: number;

  @Input()
  public title: string;

  @Input()
  public flowingProfit: boolean;

  public stats: any;
  private options: any;

  constructor(
    private http: HttpClient,
    private chartService: ChartService
  ) {
    super();
  }

  ngAfterViewInit(): void {
    this.initChart();

    this.chartService.klinesSubject.subscribe((res: any) => {
      this.postBacktest(res);
    });
  }

  private initChart(): void {
    this.options = {
      series: [{
        name: this.title,
        data: []
      }],
      chart: {
        height: 250,
        type: 'line',
        animations: {
          enabled: false
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'straight'
      },
      title: {
        text: this.title,
        align: 'left'
      },
      tooltip: {
        x: {
          formatter: (val) => {
            const d = new Date(val);
            return this.dateToSimpleString(d);
          }
        }
      },
      xaxis: {
        labels: {
          datetimeUTC: false
        },
        type: 'datetime'
      },
      yaxis: {
        labels: {
          formatter: (y) => {
            return y.toFixed(2) + '%';
          }
        }
      }
    };
  }

  private postBacktest(klines: Array<BinanceKline>): void {
    const query = {
      commission: this.commission,
      flowingProfit: this.flowingProfit
    };

    const baseUrl = this.chartService.baseUrl + '/backtest';
    const url = this.chartService.createUrl(baseUrl, query);

    this.http.post(url, klines).subscribe((res: any) => {
      const mappedPercentages = res.map(kline => {
        return {
          x: kline.times.open,
          y: kline.percentProfit
        };
      });

      this.options.series[0].data = mappedPercentages;
      this.renderChart();
      this.calcStats(res, mappedPercentages);
    });
  }

  private renderChart() {
    const chart = new ApexCharts(this.apexChart.nativeElement, this.options);
    chart.render();
  }

  private calcStats(klines: Array<BinanceKline>, percentages: Array<any>): void {
    const tradesCount = klines.filter(kline => kline.signal !== undefined).length;

    this.stats = {
      ppt: tradesCount === 0 ? '0%' : (percentages[percentages.length - 1].y / tradesCount).toFixed(3) + '%',
      ppa: this.calcProfitPerAmount(klines, percentages).toFixed(2) + '%',
      profit: percentages[percentages.length - 1].y.toFixed(2) + '%',
      trades: tradesCount,
      positiveNegative: this.calcPositiveNegative(percentages),
      drawbackProfitRatio: (this.calcMaxDrawback(percentages) / percentages[percentages.length - 1].y).toFixed(2) + '%',
      maxDrawback: this.calcMaxDrawback(percentages).toFixed(2) + '%',
    };
  }

  private calcMaxDrawback(percentages: Array<any>): number {
    let high = 0;
    let maxDrawback = 0;

    percentages.forEach(kline => {
      if (kline.y < high) {
        if (high - kline.y > maxDrawback) {
          maxDrawback = high - kline.y;
        }
      } else {
        high = kline.y;
      }
    });

    return maxDrawback;
  }

  private calcPositiveNegative(percentages: Array<any>): string {
    let pos = 0;
    let neg = 0;
    let lastPercentage;

    percentages.map(p => p.y).forEach(percentage => {
      if (lastPercentage !== undefined) {
        if (percentage > lastPercentage) {
          pos++;
        } else if (percentage < lastPercentage) {
          neg++;
        }
      }

      lastPercentage = percentage;
    });

    return pos + ' / ' + neg;
  }

  private calcProfitPerAmount(klines: Array<BinanceKline>, percentages: Array<any>): number {
    let totalAmount = 0;

    klines.forEach((kline: BinanceKline) => {
      if (kline.signal) {
        totalAmount += kline.amount ?? 1;
      }
    });

    return totalAmount === 0 ? 0 : percentages[percentages.length - 1].y / totalAmount;
  }

}
