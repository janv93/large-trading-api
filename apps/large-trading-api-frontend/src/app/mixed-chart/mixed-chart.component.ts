import { Component, ChangeDetectorRef, ElementRef, Input, NgZone, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { CandlestickData, createChart, IChartApi, ISeriesApi, LastPriceAnimationMode, LineData, LineStyle, MouseEventParams, SeriesMarker, Time } from 'lightweight-charts';
import { BacktestStats, Kline, Klines } from '../interfaces';
import { ChartService } from '../chart.service';
import { BaseComponent } from '../base-component';

@Component({
  selector: 'mixed-chart',
  templateUrl: './mixed-chart.component.html',
  styleUrls: ['./mixed-chart.component.scss']
})
export class MixedChartComponent extends BaseComponent implements OnInit, OnDestroy {
  @ViewChild('container') containerRef: ElementRef;
  @ViewChild('legend') legend: ElementRef;
  @Input() klines: Klines[];

  public ohlc: CandlestickData;
  public currentProfit: number;
  public stats: BacktestStats;
  public currentKlines: Kline[];
  private chart: IChartApi;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private profitSeries: ISeriesApi<'Line'>[] = [];
  private commissionChecked = false;
  private flowingProfitChecked = true;
  private finalProfit: number[] = [];

  constructor(
    public chartService: ChartService,
    private zone: NgZone,
    private renderer: Renderer2,
    private cd: ChangeDetectorRef
  ) {
    super();
  }

  ngOnInit(): void {
    this.setKlines();
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
          visible: !this.chartService.isMulti
        },
        rightPriceScale: {
          visible: !this.chartService.isMulti
        },
        timeScale: {
          minBarSpacing: 0.001
        },

      });

      this.addLegend();
      this.applyDarkTheme(this.chart);
      this.drawSeries();
      this.chart.timeScale().fitContent();
    });
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }

  /**
   * interpolates the color between red and green, depending on value
   */
  public getColor(value: number, maxGreen: number, maxRed: number): string {
    // negative value means negative profit
    if (value < 0) {
      return 'rgb(255, 77, 77)';
    }

    let red, green, blue;
    let range = maxRed - maxGreen;

    if (value <= maxGreen) {
      red = 0;
      green = 255;
      blue = 0;
    } else if (value >= maxRed) {
      red = 255;
      green = 77;
      blue = 77;
    } else {
      const t = (value - maxGreen) / range;
      red = Math.floor(255 * t);
      green = Math.floor(255 * (1 - t) + 77 * t);
      blue = Math.floor(77 * t);
    }

    return `rgb(${red}, ${green}, ${blue})`;
  }

  public onCommissionChange(event: Event) {
    const checked: boolean = (event.target as HTMLInputElement).checked;
    this.commissionChecked = checked;
    this.setKlines();

    this.chartService.algorithms.forEach((algorithm, index) => {
      this.setProfitSeriesData(index);
    });
  }

  public onFlowingProfitChange(event: Event) {
    const checked: boolean = (event.target as HTMLInputElement).checked;
    this.flowingProfitChecked = checked;
    this.setKlines();

    this.chartService.algorithms.forEach((algorithm, index) => {
      this.setProfitSeriesData(index);
    });
  }

  private setKlines() {
    if (this.chartService.isMulti) {
      this.currentKlines = this.klines[0].klines; // in case of multi, only 1 available for now
    } else {
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

    this.setFinalProfits();
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

    this.candlestickSeries.applyOptions({
      priceLineVisible: false,
      lastValueVisible: false
    });
  }

  private drawProfitSeries(): void {
    this.chartService.algorithms.forEach((algorithm, index) => {
      this.profitSeries.push(this.chart.addLineSeries({ priceScaleId: index === 0 ? 'left' : 'left2' }));
      this.setProfitSeriesData(index);  // init with no commission/flowing profit

      const opacity = index === 0 ? 0.3 : 0.1;
      let color = `rgba(255,255,255,${opacity})`;
      color = this.finalProfit[index] > 0 ? `rgba(0,255,0,${opacity})` : color;
      color = this.finalProfit[index] < 0 ? `rgba(255,77,77,${opacity})` : color;

      this.profitSeries[index].applyOptions({
        color,
        priceLineVisible: false,
        lastValueVisible: false
      });
    });

    this.calcStats();
  }

  private setCandlestickSeriesData(): void {
    const mapped = this.klines[0].klines.map((kline: Kline) => {
      return {
        time: kline.times.open / 1000 as Time,
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
      if (kline.algorithms[this.chartService.algorithms[0]].signal) {
        markers.push(this.getTemplate(kline));
      }
    });

    this.candlestickSeries.setMarkers(markers);
  }

  private getTemplate(kline: Kline): SeriesMarker<Time> {
    const signal = ['CLOSEBUY', 'CLOSESELL'].includes(kline.algorithms[this.chartService.algorithms[0]].signal!) ? kline.algorithms[this.chartService.algorithms[0]].signal!.replace('LOSE', '') : kline.algorithms[this.chartService.algorithms[0]].signal;

    return {
      time: kline.times.open / 1000 as Time,
      position: ['BUY', 'CBUY'].includes(signal!) ? 'belowBar' : 'aboveBar',
      color: ['BUY', 'CBUY'].includes(signal!) ? 'lime' : kline.algorithms[this.chartService.algorithms[0]].signal === 'CLOSE' ? 'white' : '#ff4d4d',
      shape: ['BUY', 'CBUY'].includes(signal!) ? 'arrowUp' : 'arrowDown',
      text: signal + (kline.algorithms[this.chartService.algorithms[0]].amount ? ` ${kline.algorithms[this.chartService.algorithms[0]].amount}` : '')
    };
  }

  private setProfitSeriesData(index: number) {
    const mapped = this.currentKlines.map((kline: Kline) => {

      return {
        time: kline.times.open / 1000 as Time,
        value: kline.algorithms[this.chartService.algorithms[index]].percentProfit
      }
    });

    this.profitSeries[index].setData(mapped);
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
      const profit = param.seriesData.get(this.profitSeries[0]) as LineData;

      if (ohlc) {
        for (const key in ohlc) {
          if (typeof ohlc[key] === "number") {
            ohlc[key] = parseFloat(ohlc[key].toFixed(2));
          }
        }

        this.ohlc = ohlc;
        this.currentProfit = Number(profit.value.toFixed(2));
        this.cd.detectChanges();
      }
    });
  }

  private calcStats(): void {
    const tradesCount = this.currentKlines.filter(kline => kline.algorithms[this.chartService.algorithms[0]].signal !== undefined && kline.algorithms[this.chartService.algorithms[0]].signal !== this.closeSignal).length;
    const posNeg = this.calcPositiveNegativeTrades();

    this.stats = {
      profit: Number(this.finalProfit[0].toFixed(2)),
      numberOfTrades: tradesCount,
      positive: posNeg[0],
      negative: posNeg[1],
      maxDrawback: Number(this.calcMaxDrawback().toFixed(2)),
    };
  }

  private calcPositiveNegativeTrades(): number[] {
    let pos = 0;
    let neg = 0;
    let lastPercentage;

    this.currentKlines
      .filter(kline => kline.algorithms[this.chartService.algorithms[0]].signal)
      .map(p => p.algorithms[this.chartService.algorithms[0]].percentProfit || 0)
      .forEach(percentage => {
        if (lastPercentage !== undefined) {
          const diff = Math.abs(percentage - lastPercentage);
          const isEqual = diff <= this.chartService.commission + 0.001; // 0.001 prevents floating point error

          if (!isEqual && percentage > lastPercentage) {
            pos++;
          } else if (!isEqual && percentage < lastPercentage) {
            neg++;
          }
        }

        lastPercentage = percentage;
      });

    return [pos, neg];
  }

  /**
   * max drawback = max percentage drop of profit / highest profit
   */
  private calcMaxDrawback(): number {
    let high = 0, maxDrawback = 0, highestProfit = 0, lowestProfit = 0;

    this.currentKlines.forEach(kline => {
      const profit = kline.algorithms[this.chartService.algorithms[0]].percentProfit || 0;
      highestProfit = Math.max(highestProfit, profit);
      lowestProfit = Math.min(lowestProfit, profit);
      high = Math.max(high, profit);
      maxDrawback = Math.max(maxDrawback, high - profit);
    });

    if (highestProfit === 0) {
      if (lowestProfit === 0) {
        return 0; // profit always 0
      } else {
        return 100; // profit always negative
      }
    } else {
      return maxDrawback / highestProfit * 100;
    }
  }

  private setFinalProfits(): void {
    this.chartService.algorithms.forEach((algorithm, index) => {
      this.finalProfit.push(this.currentKlines.at(-1)!.algorithms[this.chartService.algorithms[index]].percentProfit || 0);
    });
  }
}