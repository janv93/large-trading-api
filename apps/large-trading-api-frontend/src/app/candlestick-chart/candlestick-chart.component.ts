import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';
import deepmerge from 'deepmerge';
import { ChartService } from '../chart.service';

@Component({
  selector: 'candlestick-chart',
  templateUrl: './candlestick-chart.component.html',
  styleUrls: ['./candlestick-chart.component.scss']
})
export class CandlestickChartComponent implements AfterViewInit {
  @ViewChild('apexChart')
  public apexChart: ElementRef;

  private options: any;
  private baseUrl = 'http://127.0.0.1:3000';

  constructor(
    private http: HttpClient,
    private chartService: ChartService
  ) {
  }

  ngAfterViewInit(): void {
    const symbol = 'MATICUSDT';
    this.initChart(symbol);
    this.getKlines(symbol, 1, 'momentum');
    this.chartService.strategyType = 'close';
  }

  private initChart(symbol): void {
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
        text: symbol,
        align: 'left'
      },
      tooltip: {
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

  private getKlines(symbol, times, strategy) {
    const query = this.getStrategyQuery(strategy, symbol, times);

    const baseUrl = this.baseUrl + '/klinesWithAlgorithm';
    const url = this.chartService.createUrl(baseUrl, query);

    this.http.get(url).subscribe((res: any) => {
      this.setPivots(res);
      const klines = this.mapKlines(res);
      this.options.series[0].data = klines;
      this.renderChart();
      this.chartService.klinesSubject.next(res);
    });
  }

  private getStrategyQuery(strategy, symbol, times): any {
    switch (strategy) {
      case 'pivotReversal':
        return {
          symbol: symbol,
          times: times,
          algorithm: 'pivotReversal',
          leftBars: 4,
          rightBars: 1
        };
      case 'momentum':
        return {
          symbol: symbol,
          times: times,
          algorithm: 'momentum',
          streak: 2
        };
    }
  }

  private mapKlines(klines) {
    return klines.map(kline => {
      return {
        x: new Date(kline[0]),
        y: [this.round(kline[1], 4), this.round(kline[2], 4), this.round(kline[3], 4), this.round(kline[4], 4)]
      }
    });
  }

  private round(value: string, digits: number): number {
    return Number(Number(value).toFixed(digits));
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

    const closeTemplate = {
      borderColor: '#000000',
      label: {
        borderColor: '#000000',
        style: {
          fontSize: '12px',
          color: '#fff',
          background: '#000000'
        },
        orientation: 'horizontal',
        offsetY: 130,
        text: 'CLOSE'
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
      } else if (pivot === 'CLOSE') {
        closeTemplate['x'] = Number(openTime);
        xaxis.push(deepmerge({}, closeTemplate));
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
