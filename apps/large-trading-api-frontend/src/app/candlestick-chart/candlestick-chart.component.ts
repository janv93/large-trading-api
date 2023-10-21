import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';
import { BaseComponent } from '../base-component';
import { ChartService } from '../chart.service';
import { Kline } from '../interfaces';
import { HttpService } from '../http.service';

@Component({
  selector: 'candlestick-chart',
  templateUrl: './candlestick-chart.component.html',
  styleUrls: ['./candlestick-chart.component.scss']
})
export class CandlestickChartComponent extends BaseComponent implements AfterViewInit {
  @ViewChild('apexChart')
  public apexChart: ElementRef;

  private options: any;

  constructor(
    private chartService: ChartService,
    private httpService: HttpService
  ) {
    super();
  }

  ngAfterViewInit(): void {
    this.initChart(this.chartService.symbol);
    this.getKlines();
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
          ({ series, seriesIndex, dataPointIndex, w }) => {
            var o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
            var h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
            var l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
            var c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];

            return (
              '<div class="d-flex flex-column">' +
              '<span>Open: ' + o + '</span>' +
              '<span>High: ' + h + '</span>' +
              '<span>Low: ' + l + '</span>' +
              '<span>Close: ' + c + '</span>' +
              '</div>'
            )
          }
        ],
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
        tickAmount: 5,
        labels: {
          formatter: (y) => {
            return y.toFixed(3) + '$';
          }
        }
      }
    };
  }

  private getKlines() {
    this.httpService.getKlines().subscribe((res: Kline[]) => {
      this.setSignals(res);
      const klines = this.mapKlines(res);
      this.options.series[0].data = klines;
      this.renderChart();
      this.chartService.klinesSubject.next(res);
    });
  }

  private mapKlines(klines: Kline[]) {
    return klines.map(kline => {
      return {
        x: new Date(kline.times.open),
        y: [kline.prices.open, kline.prices.high, kline.prices.low, kline.prices.close]
      }
    });
  }

  private setSignals(klines: Kline[]): void {
    const setTemplate = (openTime: number, signal: string, amount: any, offsetY: number, color: string) => {
      return {
        borderColor: color,
        x: Number(openTime),
        label: {
          borderColor: color,
          style: {
            fontSize: '12px',
            color: '#fff',
            background: color
          },
          orientation: 'horizontal',
          offsetY: offsetY,
          text: amount ? [signal, amount] : signal
        }
      };
    };

    const xaxis: any[] = [];
    const signalKlines = klines.filter(kline => kline.signal);

    signalKlines.forEach(kline => {
      const { times: { open: openTime }, signal, amount } = kline;

      let template;

      switch (signal) {
        case 'CLOSE':
          template = setTemplate(openTime, 'CLOSE', null, 130, '#000000');
          break;
        case 'BUY':
          template = setTemplate(openTime, 'BUY', amount, 7, '#00b746');
          break;
        case 'SELL':
          template = setTemplate(openTime, 'SELL', amount, 260, '#FF0000');
          break;
        case 'CLOSEBUY':
          template = setTemplate(openTime, 'CBUY', amount, 7, '#00b746');
          break;
        case 'CLOSESELL':
          template = setTemplate(openTime, 'CSELL', amount, 260, '#FF0000');
          break;
      }

      xaxis.push(template);
    });

    this.options.annotations = { xaxis };
  }

  private renderChart() {
    const chart = new ApexCharts(this.apexChart.nativeElement, this.options);
    chart.render();
  }
}
