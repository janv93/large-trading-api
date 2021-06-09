import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';
import { ChartService } from '../chart.service';

@Component({
  selector: 'profit-chart',
  templateUrl: './profit-chart.component.html',
  styleUrls: ['./profit-chart.component.scss']
})
export class ProfitChartComponent implements AfterViewInit {
  @ViewChild('apexChart')
  public apexChart: ElementRef;

  public stats: any;
  private options: any;

  constructor(
    private http: HttpClient,
    private chartService: ChartService
  ) {
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
        name: 'Profit',
        data: []
      }],
      chart: {
        height: 350,
        type: 'line'
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'straight'
      },
      title: {
        text: 'Profit',
        align: 'left'
      },
      xaxis: {
        type: 'datetime'
      }
    };
  }

  private postBacktest(klines: Array<any>): void {
    const query = {
      commission: 0.036,
      type: this.chartService.strategyType
    };

    const baseUrl = this.chartService.baseUrl + '/backtest';
    const url = this.chartService.createUrl(baseUrl, query);

    this.http.post(url, klines).subscribe((res: any) => {
      const mappedPercentages = res.map(kline => {
        return {
          x: kline.time,
          y: Number(kline.percentage.toFixed(2))
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

  private calcStats(klines: Array<any>, percentages: Array<any>): void {
    const tradesCount = klines.filter(kline => kline.signal !== undefined).length;

    this.stats = {
      trades: tradesCount,
      profit: (percentages[percentages.length - 1].y) + '%',
      ppt: (percentages[percentages.length - 1].y / tradesCount).toFixed(3) + '%',
      maxDrawback: this.calcMaxDrawback(percentages).toFixed(2) + '%'
    };
  }

  private calcMaxDrawback(klines: Array<any>): number {
    let high = 0;
    let maxDrawback = 0;

    klines.forEach(kline => {
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

}
