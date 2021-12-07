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
      case 'ema': this.initChartEma(); break;
      case 'bb': this.initChartBb(); break;
    }

    this.chartService.klinesSubject.subscribe((res: any) => {
      switch (this.chart) {
        case 'rsi': this.postRsi(res); break;
        case 'macd': this.postMacd(res); break;
        case 'ema': this.postEma(res); break;
        case 'bb': this.postBb(res); break;
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
      grid: {
        borderColor: '#000',
        position: 'front'
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
        text: 'RSI (' + this.chartService.rsiLength + ')',
        align: 'left'
      },
      xaxis: {
        labels: {
          datetimeUTC: false
        },
        type: 'datetime'
      },
      yaxis: {
        min: 0,
        max: 100,
        tickAmount: 2,
        labels: {
          formatter: (y) => {
            return y.toFixed(0);
          }
        }
      }
    };
  }

  private initChartEma(): void {
    this.options = {
      series: [{
        name: 'EMA',
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
        text: 'EMA (' + this.chartService.emaPeriodOpen + ')',
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
            return y.toFixed(3);
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

  private initChartBb(): void {
    this.options = {
      series: [
        {
          name: 'BB Upper',
          data: []
        },
        {
          name: 'Price',
          data: []
        },
        {
          name: 'BB Lower',
          data: []
        }
      ],
      chart: {
        height: 400,
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
        text: 'BB (' + this.chartService.bbPeriod + ')',
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
            return y.toFixed(3);
          }
        }
      }
    };
  }

  private postRsi(klines: Array<any>) {
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

  private postEma(klines: Array<any>) {
    const query = {
      indicator: 'ema',
      period: this.chartService.emaPeriodOpen
    };

    const url = this.chartService.createUrl(this.baseUrl, query);

    this.http.post(url, klines).subscribe((res: any) => {
      const mappedValues = res.map(val => {
        return {
          x: val.time,
          y: Number(val.ema)
        };
      });

      this.options.series[0].data = mappedValues;
      this.renderChart();
    });
  }

  private postMacd(klines: Array<any>) {
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

  private postBb(klines: Array<any>) {
    const query = {
      indicator: 'bb',
      period: this.chartService.bbPeriod
    };

    const url = this.chartService.createUrl(this.baseUrl, query);

    this.http.post(url, klines).subscribe((res: any) => {
      const mappedValuesUpper = res.map(val => {
        return {
          x: val.time,
          y: Number(val.bb.upper)
        };
      });

      const mappedValuesLower = res.map(val => {
        return {
          x: val.time,
          y: Number(val.bb.lower)
        };
      });

      const closes = klines.map(kline => kline.prices.close).slice(-res.length);
      const mappedValuesCloses = closes.map((val, index) => {
        return {
          x: res[index].time,
          y: val
        };
      });

      this.options.series[0].data = mappedValuesUpper;
      this.options.series[1].data = mappedValuesCloses;
      this.options.series[2].data = mappedValuesLower;
      this.renderChart();
    });
  }

  private renderChart() {
    const chart = new ApexCharts(this.apexChart.nativeElement, this.options);
    chart.render();
  }

}
