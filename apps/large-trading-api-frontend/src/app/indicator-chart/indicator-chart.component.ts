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
      case 'rsi': this.initChartRSI(); break;
      case 'macd': this.initChartMacd(); break;
    }

    this.chartService.klinesSubject.subscribe((res: any) => {
      switch (this.chart) {
        case 'rsi': this.postRSI(res); break;
        case 'macd': this.postMACD(res); break;
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
        type: 'line',
        animations: {
          enabled: false
        }
      },
      tooltip: {
        x: {
          formatter: (val) => {
            const d = new Date(val);
            return d.toLocaleTimeString();
          }
        }
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
        labels: {
          datetimeUTC: false
        },
        type: 'datetime'
      },
      yaxis: {
        labels: {
          formatter: (y) => {
            return y.toFixed(0);
          }
        }
      }
    };
  }

  private initChartMacd(): void {
    this.options = {
      series: [{
        name: 'MACD',
        data: []
      }],
      chart: {
        height: 200,
        type: 'bar',
        animations: {
          enabled: false
        }
      },
      plotOptions: {
        bar: {
          colors: {
            ranges: [{
              from: 0,
              to: 1,
              color: '#00b746'
            }, {
              from: -1,
              to: 0,
              color: '#ef403c'
            }]
          },
          columnWidth: '80%',
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'straight'
      },
      title: {
        text: 'MACD',
        align: 'left'
      },
      xaxis: {
        type: 'datetime',
        labels: {
          rotate: -90,
          datetimeUTC: false
        }
      },
      yaxis: {
        tickAmount: 2,
        labels: {
          formatter: (y) => {
            return (y * 1000).toFixed(2) + ' e-3';
          }
        }
      }
    };
  }

  private postRSI(klines: Array<any>) {
    const query = {
      indicator: 'rsi',
      length: this.chartService.rsiLength
    };

    const url = this.chartService.createUrl(this.baseUrl, query);

    this.http.post(url, klines).subscribe((res: any) => {
      const mappedValues = res.map(val => {
        return {
          x: val.time,
          y: Number(val.rsi)
        };
      });

      this.options.series[0].data = mappedValues;
      this.renderChart();
    });
  }

  private postMACD(klines: Array<any>) {
    const query = {
      indicator: 'macd',
      fast: 12,
      slow: 26,
      signal: 9
    };

    const url = this.chartService.createUrl(this.baseUrl, query);

    this.http.post(url, klines).subscribe((res: any) => {
      const mappedValues = res.map(val => {
        return {
          x: val.time,
          y: Number(val.histogram)
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
