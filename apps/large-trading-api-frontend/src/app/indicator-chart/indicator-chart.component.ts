import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';
import { ChartService } from '../chart.service';

@Component({
  selector: 'indicator-chart',
  templateUrl: './indicator-chart.component.html',
  styleUrls: ['./indicator-chart.component.scss']
})
export class IndicatorChartComponent implements AfterViewInit {
  @ViewChild('apexChart')
  public apexChart: ElementRef;

  @Input()
  public chart: string;

  private options: any;
  private baseUrl = this.chartService.baseUrl + '/indicators';

  constructor(
    private http: HttpClient,
    private chartService: ChartService
  ) {
  }

  ngAfterViewInit(): void {
    switch (this.chart) {
      case 'rsi': this.initChartRSI();
    }

    this.chartService.klinesSubject.subscribe((res: any) => {
      switch (this.chart) {
        case 'rsi': this.postRSI(res); break;
      }
    });
  }

  private initChartRSI(): void {
    this.options = {
      series: [{
        name: 'RSI',
        data: []
      }],
      chart: {
        height: 200,
        type: 'line'
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'straight'
      },
      title: {
        text: 'RSI',
        align: 'left'
      },
      xaxis: {
        type: 'datetime'
      }
    };
  }

  private postRSI(klines: Array<any>) {
    const query = {
      indicator: 'rsi',
      length: 14
    };

    const url = this.chartService.createUrl(this.baseUrl, query);

    this.http.post(url, klines).subscribe((res: any) => {
      const mappedValues = res.map(val => {
        return {
          x: val.time,
          y: Number(val.rsi.toFixed(2))
        };
      });

      this.options.series[0].data = mappedValues;
      this.renderChart();
    });
  }

  private renderChart() {
    const chart = new ApexCharts(this.apexChart.nativeElement, this.options);
    chart.render();
  }

}
