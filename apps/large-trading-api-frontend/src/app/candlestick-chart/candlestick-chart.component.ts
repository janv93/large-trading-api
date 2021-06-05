import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';
import deepmerge from 'deepmerge';

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

    this.getKlines('MATICUSDT', 1);
  }

  initChart() {
    this.options = {
      series: [
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
        custom: [
          function ({ seriesIndex, dataPointIndex, w }) {
            var o = w.globals.seriesCandleO[seriesIndex][dataPointIndex]
            var h = w.globals.seriesCandleH[seriesIndex][dataPointIndex]
            var l = w.globals.seriesCandleL[seriesIndex][dataPointIndex]
            var c = w.globals.seriesCandleC[seriesIndex][dataPointIndex]
            return (
              '<div class="d-flex flex-column">' +
              '<span>Open: ' + o + '</span>' +
              '<span>High: ' + h + '</span>' +
              '<span>Low: ' + l + '</span>' +
              '<span>Close: ' + c + '</span>' +
              '</div>'
            )
          }
        ]
      },
      xaxis: {
        type: 'datetime'
      }
    };
  }

  private getKlines(symbol, times) {
    const query = {
      symbol: symbol,
      times: times,
      algorithm: 'pivotReversal',
      leftBars: 4,
      rightBars: 1
    };

    const baseUrl = this.baseUrl + '/klinesWithAlgorithm';
    const url = this.createUrl(baseUrl, query);

    this.http.get(url).subscribe((res: any) => {
      this.setPivots(res);
      const klines = this.mapKlines(res);
      this.options.series[0].data = klines;
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

  private setPivots(klines: Array<any>): void {
    const buyTemplate = {
      borderColor: '#00E396',
      label: {
        borderColor: '#00E396',
        style: {
          fontSize: '12px',
          color: '#fff',
          background: '#00E396'
        },
        orientation: 'horizontal',
        offsetY: 7,
        text: 'BUY'
      }
    };

    const sellTemplate = {
      borderColor: '#FF0000',
      label: {
        borderColor: '#FF0000',
        style: {
          fontSize: '12px',
          color: '#fff',
          background: '#FF0000'
        },
        orientation: 'horizontal',
        offsetY: 260,
        text: 'SELL'
      }
    };

    const pivotKlines = klines.filter(kline => {
      return kline[12] ? true : false;
    });

    const xaxis: Array<any> = [];

    pivotKlines.forEach(kline => {
      const openTime = kline[0];
      const pivot = kline[12];

      if (pivot === 'BUY') {
        buyTemplate['x'] = Number(openTime);
        xaxis.push(deepmerge({}, buyTemplate));
      } else if (pivot === 'SELL') {
        sellTemplate['x'] = Number(openTime);
        xaxis.push(deepmerge({}, sellTemplate));
      }
    });

    this.options.annotations = {
      xaxis: xaxis
    };
  }

  private renderChart() {
    const chart = new ApexCharts(this.apexChart.nativeElement, this.options);
    chart.render();
  }

}
