import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
  private baseUrl = 'http://127.0.0.1:3000';

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
        text: 'Profit Chart',
        align: 'left'
      },
      xaxis: {
        type: 'datetime'
      }
    };
  }

  private postBacktest(klines: Array<any>): void {
    const query = {
      commission: 0.036
    };

    const baseUrl = this.baseUrl + '/backtest';
    const url = this.createUrl(baseUrl, query);

    this.http.post(url, klines).subscribe((res: any) => {
      const mappedPercentages = res.map(kline => {
        return {
          x: kline.time,
          y: Number(kline.percentage.toFixed(2))
        };
      });

      this.options.series[0].data = mappedPercentages;
      this.renderChart();
      this.calcStats(mappedPercentages);
    });
  }

  private createUrl(baseUrl: string, queryObj: any): string {
    let url = baseUrl;
    let firstParam = true;

    Object.keys(queryObj).forEach(param => {
      const query = param + '=' + queryObj[param];
      firstParam ? url += '?' : url += '&';
      url += query;
      firstParam = false;
    });

    return url;
  }

  private renderChart() {
    const chart = new ApexCharts(this.apexChart.nativeElement, this.options);
    chart.render();
  }

  private calcStats(klines: Array<any>): void {
    this.stats = {
      trades: klines.length,
      profit: (klines[klines.length - 1].y) + '%',
      ppt: (klines[klines.length - 1].y / klines.length).toFixed(3) + '%',
      maxDrawback: this.calcMaxDrawback(klines).toFixed(2) + '%'
    }

    console.log(this.stats);
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
