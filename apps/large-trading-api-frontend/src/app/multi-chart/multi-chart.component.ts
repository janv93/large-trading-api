import { Component, ChangeDetectorRef, ElementRef, Input, NgZone, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { CandlestickData, createChart, IChartApi, ISeriesApi, LineData, MouseEventParams, Time } from 'lightweight-charts';
import { BacktestStats, Kline, Klines } from '../interfaces';
import { ChartService } from '../chart.service';

@Component({
  selector: 'multi-chart',
  templateUrl: './multi-chart.component.html',
  styleUrls: ['./multi-chart.component.scss']
})
export class MultiChartComponent implements OnInit, OnDestroy {
  @ViewChild('container') containerRef: ElementRef;
  @ViewChild('legend') legend: ElementRef;
  @Input() klines: Klines[];

  public ohlc: CandlestickData;
  public profit: string;
  public stats: BacktestStats;
  public currentKlines: Kline[];
  private chart: IChartApi;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private profitSeries: ISeriesApi<'Line'>;
  private commissionChecked;
  private flowingProfitChecked;
  private finalProfit: number;

  constructor(
    public chartService: ChartService,
    private zone: NgZone,
    private renderer: Renderer2,
    private cd: ChangeDetectorRef
  ) {
  }

  ngOnInit(): void {
    this.currentKlines = this.klines[0].klines;
    this.finalProfit = this.currentKlines.at(-1)!.percentProfit || 0;
    this.calcStats();
    this.handleResize();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const container = this.containerRef.nativeElement;

      this.chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        leftPriceScale: {
          visible: true
        }
      });

      this.applyDarkTheme(this.chart);
      this.drawSeries();
      this.chart.timeScale().fitContent();
      this.addLegend();
    });
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }

  public onCommissionChange(event: Event) {
    const checked: boolean = (event.target as HTMLInputElement).checked;
    this.commissionChecked = checked;
    this.setKlines();
    this.setProfitSeriesData();
  }

  public onFlowingProfitChange(event: Event) {
    const checked: boolean = (event.target as HTMLInputElement).checked;
    this.flowingProfitChecked = checked;
    this.setKlines();
    this.setProfitSeriesData();
  }

  private setKlines() {
    const commission = this.commissionChecked;
    const flowingProfit = this.flowingProfitChecked;

    if (!commission && !flowingProfit) {
      this.currentKlines = this.klines[0].klines;
    } else if (commission && !flowingProfit) {
      this.currentKlines = this.klines[1].klines;
    } else if (!commission && flowingProfit) {
      this.currentKlines = this.klines[2].klines;
    } else if (commission && flowingProfit) {
      this.currentKlines = this.klines[3].klines;
    }
  }

  private handleResize() {
    this.renderer.listen('window', 'resize', () => {
      const container = this.containerRef.nativeElement;

      if (this.chart) {
        this.chart.resize(container.clientWidth, container.clientHeight);
      }
    });
  }

  private drawSeries(): void {
    this.drawCandlestickSeries();
    this.drawProfitSeries();
  }

  private drawCandlestickSeries(): void {
    this.candlestickSeries = this.chart.addCandlestickSeries({ priceScaleId: 'right' });
    this.setCandlestickSeriesData();
    this.setCandlestickSeriesSignals();
  }

  private drawProfitSeries(): void {
    this.profitSeries = this.chart.addLineSeries({ priceScaleId: 'left' });
    this.setProfitSeriesData();  // init with no commission/flowing profit
  }

  private setCandlestickSeriesData(): void {
    const mapped = this.klines[0].klines.map((kline: Kline) => {
      return {
        time: new Date(kline.times.open).toISOString().slice(0, 10),
        open: kline.prices.open,
        high: kline.prices.high,
        low: kline.prices.low,
        close: kline.prices.close
      }
    });

    this.candlestickSeries.setData(mapped);
  }

  private setCandlestickSeriesSignals() {
    const markers: any[] = [];

    this.klines[0].klines.forEach((kline: Kline) => {
      if (kline.signal) {
        markers.push(this.setTemplate(kline));
      }
    });

    this.candlestickSeries.setMarkers(markers);
  }

  private setProfitSeriesData() {
    const mapped = this.currentKlines.map((kline: Kline) => {
      return {
        time: new Date(kline.times.open).toISOString().slice(0, 10),
        value: kline.percentProfit
      }
    });

    this.profitSeries.setData(mapped);
    this.calcStats();
  }

  private setTemplate(kline: Kline): any {
    const signal = ['CLOSEBUY', 'CLOSESELL'].includes(kline.signal!) ? kline.signal!.replace('LOSE', '') : kline.signal;

    return {
      time: new Date(kline.times.open).toISOString().slice(0, 10),
      position: ['BUY', 'CBUY'].includes(signal!) ? 'belowBar' : 'aboveBar',
      color: ['BUY', 'CBUY'].includes(signal!) ? 'lime' : kline.signal === 'CLOSE' ? 'white' : '#ff4d4d',
      shape: ['BUY', 'CBUY'].includes(signal!) ? 'arrowUp' : 'arrowDown',
      text: signal + (kline.amount ? ` ${kline.amount}` : '')
    };
  }

  private applyDarkTheme(chart: IChartApi) {
    chart.applyOptions({
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#FFFFFF',
      },
      grid: {
        vertLines: {
          color: '#333333',
        },
        horzLines: {
          color: '#333333',
        },
      },
      crosshair: {
        vertLine: {
          color: '#FFFFFF'
        },
        horzLine: {
          color: '#FFFFFF'
        }
      }
    });
  }

  private addLegend() {
    this.chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
      const ohlc = param.seriesData.get(this.candlestickSeries) as CandlestickData;
      const profit = param.seriesData.get(this.profitSeries) as LineData;

      if (ohlc) {
        for (const key in ohlc) {
          if (typeof ohlc[key] === "number") {
            ohlc[key] = parseFloat(ohlc[key].toFixed(2));
          }
        }

        this.ohlc = ohlc;
        this.profit = profit.value.toFixed(2) + '%';
        this.cd.detectChanges();
      }
    });
  }

  private calcStats(): void {
    const tradesCount = this.currentKlines.filter(kline => kline.signal !== undefined).length;

    this.stats = {
      profitPerAmount: this.calcProfitPerAmount().toFixed(2) + '%',
      profit: this.finalProfit.toFixed(2) + '%',
      numberOfTrades: tradesCount,
      positiveNegative: this.calcPositiveNegative(),
      drawbackProfitRatio: ((this.calcMaxDrawback() / this.finalProfit)).toFixed(2) + 'x',
      maxDrawback: this.calcMaxDrawback().toFixed(2) + '%',
    };
  }

  private calcProfitPerAmount(): number {
    let totalAmount = 0;

    this.currentKlines.forEach((kline: Kline) => {
      if (kline.signal) {
        totalAmount += kline.amount ?? 1;
      }
    });

    return totalAmount === 0 ? 0 : this.finalProfit / totalAmount;
  }

  private calcPositiveNegative(): string {
    let pos = 0;
    let neg = 0;
    let lastPercentage;

    this.currentKlines.map(p => p.percentProfit || 0).forEach(percentage => {
      if (lastPercentage !== undefined) {
        if (percentage > lastPercentage) {
          pos++;
        } else if (percentage < lastPercentage) {
          neg++;
        }
      }

      lastPercentage = percentage;
    });

    return pos + ' / ' + neg;
  }

  private calcMaxDrawback(): number {
    let high = 0;
    let maxDrawback = 0;

    this.currentKlines.forEach(kline => {
      const profit = kline.percentProfit || 0;

      if (profit < high) {
        if (high - profit > maxDrawback) {
          maxDrawback = high - profit;
        }
      } else {
        high = profit;
      }
    });

    return maxDrawback;
  }
}


