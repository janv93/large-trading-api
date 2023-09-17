import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';
import deepmerge from 'deepmerge';
import { BaseComponent } from '../base-component';
import { ChartService } from '../chart.service';
import { BinanceKline } from '../interfaces';
import { Observable } from 'rxjs';

@Component({
  selector: 'candlestick-chart',
  templateUrl: './candlestick-chart.component.html',
  styleUrls: ['./candlestick-chart.component.scss']
})
export class CandlestickChartComponent extends BaseComponent implements AfterViewInit {
  @ViewChild('apexChart')
  public apexChart: ElementRef;

  private options: any;
  private baseUrl = 'http://127.0.0.1:3000';

  constructor(
    private http: HttpClient,
    private chartService: ChartService
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
    const query = this.getStrategyQuery();
    const baseUrl = this.baseUrl + '/klinesWithAlgorithm';
    const url = this.chartService.createUrl(baseUrl, query);

    this.http.get(url).subscribe((res: any) => {
      this.setSignals(res);
      const klines = this.mapKlines(res);
      this.options.series[0].data = klines;
      this.renderChart();
      this.chartService.klinesSubject.next(res);
    });
  }

  private getStrategyQuery(): any {
    const { exchange, strategy, symbol, times, timeframe } = this.chartService;

    switch (strategy) {
      case 'pivotReversal':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'pivotReversal',
          leftBars: 4,
          rightBars: 1
        };
      case 'momentum':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'momentum',
          streak: this.chartService.momentumStreak
        };
      case 'macd':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'macd',
          fast: 12,
          slow: 26,
          signal: 9
        };
      case 'rsi':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'rsi',
          length: this.chartService.rsiLength
        };
      case 'ema':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'ema',
          periodOpen: this.chartService.emaPeriodOpen,
          periodClose: this.chartService.emaPeriodClose
        };
      case 'emasl':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'emasl',
          period: this.chartService.emaPeriodSL
        };
      case 'bb':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'bb',
          period: this.chartService.bbPeriod
        };
      case 'deepTrend':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'deepTrend'
        };
      case 'dca':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'dca'
        };
      case 'martingale':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'martingale',
          threshold: this.chartService.martingaleThreshold,
          exitMultiplier: this.chartService.martingaleExitMultiplier
        };
      case 'flashCrash':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'flashCrash'
        };
      case 'twitterSentiment':
        return {
          exchange,
          symbol,
          times,
          timeframe,
          algorithm: 'twitterSentiment',
          user: this.chartService.twitterUser
        };
    }
  }

  private mapKlines(klines: Array<BinanceKline>) {
    return klines.map(kline => {
      return {
        x: new Date(kline.times.open),
        y: [kline.prices.open, kline.prices.high, kline.prices.low, kline.prices.close]
      }
    });
  }

  private setSignals(klines: Array<any>): void {
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

    const xaxis: Array<any> = [];
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
