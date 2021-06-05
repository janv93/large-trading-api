import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';

@Component({
  selector: 'candlestick-chart',
  templateUrl: './candlestick-chart.component.html',
  styleUrls: ['./candlestick-chart.component.scss']
})
export class CandlestickChartComponent implements AfterViewInit, OnInit {
  @ViewChild('apexChart')
  public apexChart: ElementRef;
  
  private options: any;
  private baseUrl = 'http://127.0.0.1:3000';

  constructor(private http: HttpClient) {
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.initChart();

    this.getKlines('BTCUSDT', 1);
  }

  initChart() {
    this.options = {
      series: [
        /*{
          name: 'line',
          type: 'line',
          data: [
            {
              x: new Date(1538778600000),
              y: 6604
            }, {
              x: new Date(1538782200000),
              y: 6602
            }, {
              x: new Date(1538814600000),
              y: 6607
            }, {
              x: new Date(1538884800000),
              y: 6620
            }
          ]
        },*/
        {
          name: 'candle',
          type: 'candlestick',
          data: []
        }],
      chart: {
        height: 350,
        type: 'candlestick',
        animations: {
          enabled: false
        }
      },
      title: {
        text: 'CandleStick Chart',
        align: 'left'
      },
      stroke: {
        width: [3, 1]
      },
      tooltip: {
        shared: true,
        custom: [function ({ seriesIndex, dataPointIndex, w }) {
          return w.globals.series[seriesIndex][dataPointIndex]
        }, function ({ seriesIndex, dataPointIndex, w }) {
          var o = w.globals.seriesCandleO[seriesIndex][dataPointIndex]
          var h = w.globals.seriesCandleH[seriesIndex][dataPointIndex]
          var l = w.globals.seriesCandleL[seriesIndex][dataPointIndex]
          var c = w.globals.seriesCandleC[seriesIndex][dataPointIndex]
          return (
            ''
          )
        }]
      },
      xaxis: {
        type: 'datetime'
      }
    };
  }

  private getKlines(symbol, times) {
    const query = {
      symbol: symbol,
      times: times
    };

    const baseUrl = this.baseUrl + '/klines';

    const url = this.createUrl(baseUrl, query);

    this.http.get(url).subscribe(res => {
      const klines = this.mapKlines(res);
      this.options.series[0].data = klines;
      console.log(klines);
      this.renderChart();
    });
  }

  private mapKlines(klines) {
    return klines.map(kline => {
      return {
        x: new Date(kline[0]),
        y: [Number(kline[1]), Number(kline[2]), Number(kline[3]), Number(kline[4])]
      }
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

}
