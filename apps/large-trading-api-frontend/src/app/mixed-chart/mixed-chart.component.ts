import { Component, ElementRef, Inject, Input, OnDestroy, OnInit, Renderer2, ViewChild, signal } from '@angular/core';
import { CandlestickData, createChart, IChartApi, ISeriesApi, LineData, MouseEventParams, SeriesMarker, Time, CrosshairMode, UTCTimestamp, HistogramData, ITimeScaleApi, WhitespaceData } from 'lightweight-charts';
import { BacktestStats, Kline, Run, PivotPoint, PivotPointSide, TrendLinePosition, Signal, TrendLine, Algorithm, BacktestSignal, BacktestData, SignalReference } from '../interfaces';
import { ChartService } from '../chart.service';
import { BaseComponent } from '../base-component';
import { LinearFunction } from '../linear-function';

@Component({
    selector: 'mixed-chart',
    templateUrl: './mixed-chart.component.html',
    styleUrls: ['./mixed-chart.component.scss'],
    standalone: false
})
export class MixedChartComponent extends BaseComponent implements OnInit, OnDestroy {
  @ViewChild('container') containerRef: ElementRef;
  @ViewChild('legend') legend: ElementRef;
  @Input() klines: Run[];

  public currentOhlc: CandlestickData;
  public currentProfit: number;
  public currentIndex: number;
  public openPositionSize: number;
  public stats: BacktestStats;
  public currentKlines: Kline[];
  private chart: IChartApi;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private profitSeries: ISeriesApi<'Line'>[] = [];
  private openPositionSizeSeries: ISeriesApi<'Histogram'> | undefined;
  private trendLineSeries: ISeriesApi<'Line'>[] = [];
  private commissionChecked = false;
  private positionSizeChecked = false;
  private finalProfit: number[] = [];
  private red = 'rgb(255, 77, 77)';
  private green = 'rgb(0, 255, 0)';
  private markersPivotPoints: SeriesMarker<Time>[] = [];
  private markersSignals: SeriesMarker<Time>[] = [];
  private isCrosshairSubscribed = false;
  private executingCrosshairMove = false;
  private currentHighlightedTrendLines: ISeriesApi<'Line'>[] = [];

  constructor(
    public chartService: ChartService,
    @Inject(Renderer2) private renderer: Renderer2
  ) {
    super();
  }

  ngOnInit(): void {
    this.setKlines();
    this.setFinalProfits();
    this.calcStats();
    this.handleResize();
  }

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.remove();
    }
  }

  /**
   * interpolates the color between red and green, depending on value
   */
  public getDrawbackColor(value: number, maxGreen: number, maxRed: number): string {
    // negative value means negative profit
    if (value < 0) {
      return this.red;
    }

    let red, green, blue;
    const range: number = maxRed - maxGreen;

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
    this.setFinalProfits();
    this.drawSeries();
    this.setLegendValues();
    this.drawChartData();

    this.chartService.algorithms.forEach((algorithm, index) => {
      this.setProfitSeriesData(index);
    });
  }

  public onShowPositionSizeChange(event: Event) {
    const checked: boolean = (event.target as HTMLInputElement).checked;
    this.positionSizeChecked = checked;
    this.drawOpenPositionSize();
  }

  public onShowChartingChange(event: Event) {
    const checked: boolean = (event.target as HTMLInputElement).checked;

    if (checked) {
      this.drawChartData();
    } else {
      this.trendLineSeries.forEach(series => this.chart.removeSeries(series));
      this.trendLineSeries = [];
      this.candlestickSeries.setMarkers(this.markersSignals);
    }
  }

  private createChart() {
    const container = this.containerRef.nativeElement;
    const width = Math.floor(container.getBoundingClientRect().width);
    const height = Math.floor(container.getBoundingClientRect().height);

    this.chart = createChart(container, {
      width,
      height,
      leftPriceScale: {
        visible: !this.chartService.isMulti
      },
      rightPriceScale: {
        visible: !this.chartService.isMulti
      },
      timeScale: {
        minBarSpacing: 0.001
      }
    });

    this.setLegendValues();
    this.applyDarkTheme(this.chart);
    this.drawSeries();
    this.drawChartData();
    this.chart.timeScale().fitContent();
  }

  private setKlines() {
    if (this.chartService.isMulti) {
      this.currentKlines = this.klines[0].klines; // in case of multi, only 1 available for now
    } else {
      const commission = this.commissionChecked;

      if (!commission) {
        this.currentKlines = this.klines[0].klines;
      } else {
        this.currentKlines = this.klines[1].klines;
      }
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
    if (this.candlestickSeries) {
      this.chart.removeSeries(this.candlestickSeries);
    }

    this.candlestickSeries = this.chart.addCandlestickSeries({ priceScaleId: 'right' });
    this.setCandlestickSeriesData();
    this.setSignalsMarkers();

    this.candlestickSeries.applyOptions({
      priceLineVisible: false,
      lastValueVisible: false
    });
  }

  private drawProfitSeries(): void {
    this.profitSeries.forEach(series => this.chart.removeSeries(series));
    this.profitSeries = [];

    this.chartService.algorithms.forEach((algorithm, index) => {
      this.profitSeries.push(this.chart.addLineSeries({ priceScaleId: index === 0 ? 'left' : 'left2' }));
      this.setProfitSeriesData(index);  // init with no commission

      this.profitSeries[index].applyOptions({
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
    });

    this.calcStats();
  }

  private drawOpenPositionSize(): void {
    if (this.positionSizeChecked) {
      if (this.openPositionSizeSeries) {
        this.chart.removeSeries(this.openPositionSizeSeries);
      }

      this.openPositionSizeSeries = this.chart.addHistogramSeries({ priceScaleId: 'histogram' });
      this.setOpenPositionSizeSeriesData();

      this.openPositionSizeSeries.applyOptions({
        priceLineVisible: false,
        lastValueVisible: false
      });
    } else {
      if (this.openPositionSizeSeries) {
        this.chart.removeSeries(this.openPositionSizeSeries);
        this.openPositionSizeSeries = undefined;
      }
    }
  }

  private drawChartData() {
    // this.setPivotPointsMarkers();
    this.setTrendLines();
  }

  private setPivotPointsMarkers() {
    const markers: SeriesMarker<Time>[] = [];

    this.currentKlines.forEach((kline: Kline) => {
      if (kline.chart?.pivotPoints) {
        markers.push(this.getPivotPointTemplate(kline));
      }
    });

    this.markersPivotPoints = markers;
    this.drawMarkers();
  }

  private setTrendLines() {
    this.trendLineSeries.forEach(series => this.chart.removeSeries(series));
    this.trendLineSeries = [];
    const filtered = this.currentKlines.filter((kline: Kline) => kline.chart?.trendLines?.length);

    filtered.forEach((kline: Kline) => {
      this.setTrendLineSeriesData(kline);
    });
  }

  private setCandlestickSeriesData(): void {
    const mapped = this.currentKlines.map((kline: Kline) => {
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

  private setSignalsMarkers() {
    const markers: SeriesMarker<Time>[] = [];

    this.currentKlines.forEach((kline: Kline) => {
      if (kline.algorithms[this.chartService.algorithms[0]]!.signals.length) {
        markers.push(this.getSignalTemplate(kline));
      }
    });

    this.markersSignals = markers;
    this.drawMarkers();
  }

  // combine all markers
  private drawMarkers() {
    const allMarkers = [...this.markersSignals, ...this.markersPivotPoints];
    allMarkers.sort((a, b) => (a.time as UTCTimestamp) - (b.time as UTCTimestamp));
    this.candlestickSeries.setMarkers(allMarkers);
  }

  private getSignalTemplate(kline: Kline): SeriesMarker<Time> {
    const algorithm = this.chartService.algorithms[0];
    const backtest: BacktestData = kline.algorithms[algorithm]!
    const backtestSignals: BacktestSignal[] = backtest.signals;
    const signals: Signal[] = backtestSignals.map((signal: BacktestSignal) => signal.signal);
    const hasBuy: boolean = signals.includes(Signal.Buy);
    const hasSell: boolean = signals.includes(Signal.Sell);
    const hasClose: boolean = signals.includes(Signal.Close);
    const hasLiquidation: boolean = signals.includes(Signal.Liquidation);
    const hasTakeProfit: boolean = signals.includes(Signal.TakeProfit);
    const hasStopLoss: boolean = signals.includes(Signal.StopLoss);
    const hasForceClose: boolean = hasLiquidation || hasTakeProfit || hasStopLoss;
    const hasMultipleForceClose: boolean = [hasLiquidation, hasTakeProfit, hasStopLoss].filter((val: boolean) => val).length > 1;
    const isBuy: string | undefined = hasBuy && !hasSell && !hasClose && !hasForceClose ? 'BUY' : undefined;
    const isSell: string | undefined = hasSell && !hasBuy && !hasClose && !hasForceClose ? 'SELL' : undefined;
    const isClose: string | undefined = !hasBuy && !hasSell && !hasForceClose ? 'CLOSE' : undefined;
    const isLiquidation: string | undefined = hasLiquidation && !hasMultipleForceClose && !hasClose && !hasBuy && !hasSell ? 'LIQ' : undefined;
    const isTakeProfit: string | undefined = hasTakeProfit && !hasMultipleForceClose && !hasClose && !hasBuy && !hasSell ? 'TP' : undefined;
    const isStopLoss: string | undefined = hasStopLoss && !hasMultipleForceClose && !hasClose && !hasBuy && !hasSell ? 'SL' : undefined;
    const isCloseBuy: string | undefined = (hasClose || hasForceClose) && !hasMultipleForceClose && hasBuy && !hasSell ? 'CBUY' : undefined;
    const isCloseSell: string | undefined = (hasClose || hasForceClose) && !hasMultipleForceClose && hasSell && !hasBuy ? 'CSELL' : undefined;
    const isMix: string | undefined = hasBuy && hasSell || hasClose && hasForceClose || hasMultipleForceClose ? 'MIX' : undefined;
    let signal: string = (isBuy || isSell || isClose || isLiquidation || isTakeProfit || isStopLoss || isCloseBuy || isCloseSell || isMix)!;

    // sum up sizes of all signals of this kline
    const totalSize: number = backtestSignals.reduce((acc: number, signal: BacktestSignal) => {
      const isCloseSignal: boolean = this.isCloseSignal(signal.signal);
      return isCloseSignal ? acc + 0 : acc + signal.size!;
    }, 0);

    return {
      time: kline.times.open / 1000 as Time,
      position: ['BUY', 'CBUY'].includes(signal) ? 'belowBar' : 'aboveBar',
      color: ['BUY', 'CBUY'].includes(signal) ? 'lime' : ['CLOSE', 'LIQ', 'TP', 'SL', 'MIX'].includes(signal) ? 'white' : '#ff4d4d',
      shape: ['BUY', 'CBUY'].includes(signal) ? 'arrowUp' : 'arrowDown',
      text: signal + (totalSize ? ` ${totalSize.toFixed(2)}` : '')
    };
  }

  private getPivotPointTemplate(kline: Kline): SeriesMarker<Time> {
    const pivotPoint: PivotPoint = kline.chart?.pivotPoints![0]!;

    return {
      time: kline.times.open / 1000 as Time,
      position: pivotPoint.side === PivotPointSide.High ? 'aboveBar' : 'belowBar',
      color: 'white',
      shape: pivotPoint.side === PivotPointSide.High ? 'arrowDown' : 'arrowUp',
      text: 'PP'
    };
  }

  private setProfitSeriesData(index: number) {
    const mapped = this.currentKlines.map((kline: Kline) => {
      const currentProfit: number = kline.algorithms[this.chartService.algorithms[index]]!.percentProfit || 0;
      const opacity: number = index === 0 ? 0.3 : 0.1;
      const color: string = currentProfit === 0 ? `rgba(255,255,255,${opacity})` : currentProfit > 0 ? `rgba(0,255,0,${opacity})` : `rgba(255,77,77,${opacity})`;

      return {
        time: kline.times.open / 1000 as Time,
        value: currentProfit,
        color
      };
    });

    this.profitSeries[index].setData(mapped);
  }

  private setOpenPositionSizeSeriesData() {
    const mapped = this.currentKlines.map((kline: Kline) => {
      const openPositionSize: number = kline.algorithms[this.chartService.algorithms[0]]!.openPositionSize!;
      const color = openPositionSize === 0 ? `transparent` : openPositionSize > 0 ? `rgba(0, 255, 162, 0.3)` : `rgba(255, 0, 170, 0.3)`;

      return {
        time: kline.times.open / 1000 as Time,
        value: openPositionSize,
        color
      };
    });

    if (this.openPositionSizeSeries) {
      this.openPositionSizeSeries.setData(mapped);
    }
  }

  private setTrendLineSeriesData(kline: Kline) {
    kline.chart!.trendLines!.forEach((trendLine: TrendLine) => {
      const start = {
        time: kline.times.open / 1000 as Time,
        value: trendLine.position === TrendLinePosition.Above ? kline.prices.high : kline.prices.low
      };

      const endKline: Kline = this.currentKlines[trendLine.endIndex];

      let end;

      if (trendLine.breakThroughIndex) {
        const breakthroughKline: Kline = this.currentKlines[trendLine.breakThroughIndex];
        const lineFunction = new LinearFunction(trendLine.function.m, trendLine.function.b);
        const value = lineFunction.getY(trendLine.breakThroughIndex);

        end = {
          time: breakthroughKline.times.open / 1000 as Time,
          value
        };
      } else {  // no breakthrough
        end = {
          time: endKline.times.open / 1000 as Time,
          value: trendLine.position === TrendLinePosition.Above ? endKline.prices.high : endKline.prices.low
        };
      }

      const data = [start, end];
      this.trendLineSeries.push(this.chart.addLineSeries({ priceScaleId: 'right' }));
      this.trendLineSeries.at(-1)!.setData(data);

      this.trendLineSeries.at(-1)!.applyOptions({
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        lineWidth: 1
      });
    });
  }

  private applyDarkTheme(chart: IChartApi) {
    chart.applyOptions({
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#FFFFFF',
      },
      grid: {
        vertLines: {
          color: 'rgba(255, 255, 255, 0.0)'
        },
        horzLines: {
          color: 'rgba(255, 255, 255, 0.0)'
        },
      },
      crosshair: {
        vertLine: {
          color: '#FFFFFF'
        },
        horzLine: {
          color: '#FFFFFF'
        },
        mode: CrosshairMode.Normal
      }
    });
  }

  // set values for top left legend
  private setLegendValues() {
    if (this.isCrosshairSubscribed) {
      this.chart.unsubscribeCrosshairMove(() => {
        this.subscribeCrosshairMove();
      });
    } else {
      this.subscribeCrosshairMove();
    }
  }

  private subscribeCrosshairMove() {
    this.chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
      if (!this.executingCrosshairMove) {
        this.executingCrosshairMove = true;
        this.isCrosshairSubscribed = true;
        const ohlc = param.seriesData.get(this.candlestickSeries) as CandlestickData;
        const profit = param.seriesData.get(this.profitSeries[0]) as LineData;
        const openPositionSize: HistogramData | undefined = this.openPositionSizeSeries ? param.seriesData.get(this.openPositionSizeSeries) as HistogramData : undefined;
        const index: number = param.logical as number;
        const kline: Kline | undefined = this.currentKlines[index];

        if (ohlc) {
          for (const key in ohlc) {
            if (typeof ohlc[key] === "number") {
              ohlc[key] = parseFloat(ohlc[key].toFixed(2));
            }
          }

          this.currentOhlc = ohlc;
          this.currentProfit = Number(profit.value.toFixed(2));
          this.currentIndex = param.logical as number;

          if (openPositionSize !== undefined) {
            this.openPositionSize = Number(openPositionSize.value.toFixed(2));
          }
        }

        if (kline) {
          this.highlightOpenSignals(kline);
        }

        this.highlightTrendLines(param);
        this.executingCrosshairMove = false;
      }
    });
  }

  private highlightOpenSignals(kline: Kline) {
    const algorithm: Algorithm = this.chartService.algorithms[0];
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;
    const openTimes: number[] = [];

    signals.forEach((signal: BacktestSignal) => {
      if (signal.openSignalReferences) {
        signal.openSignalReferences.forEach((signalReference: SignalReference) => {
          openTimes.push(signalReference.openTime);
        });
      }
    });

    this.markersSignals.forEach((marker: SeriesMarker<Time>) => {
      marker.size = undefined;

      if (openTimes.includes((marker.time as UTCTimestamp) * 1000)) {
        marker.size = 3;
      }
    });

    this.drawMarkers();
  }

  private highlightTrendLines(param: MouseEventParams<Time>) {
    if (!param?.point || !param.logical || !this.trendLineSeries.length) return;
    const hoverPrice: number = this.candlestickSeries.coordinateToPrice(param.point!.y) as number;
    const index: number = param.logical as number;

    this.currentHighlightedTrendLines.forEach((trendLine: ISeriesApi<'Line'>) => trendLine.applyOptions({ color: '#2196f3' }));
    this.currentHighlightedTrendLines = [];

    this.trendLineSeries.forEach((trendLine: ISeriesApi<'Line'>) => {
      const data: readonly (WhitespaceData<Time> | LineData<Time>)[] = trendLine.data();
      const start: any = data[0];
      const end: any = data[1];
      const startIndex: number = this.findKlineIndexByOpenTime(this.currentKlines, (start.time as number) * 1000);
      const endIndex: number = this.findKlineIndexByOpenTime(this.currentKlines, (end.time as number) * 1000);
      const lineFunction: LinearFunction = new LinearFunction(startIndex, start.value, endIndex, end.value);
      const isLineHovered: boolean = lineFunction.isPointOnLine(index, hoverPrice, 0.003) && index >= startIndex && index <= endIndex;

      if (isLineHovered) {
        trendLine.applyOptions({ color: 'yellow' });
        this.currentHighlightedTrendLines.push(trendLine);
      }
    });
  }

  private calcStats(): void {
    const algorithm: Algorithm = this.chartService.algorithms[0];

    const tradesCount: number = this.currentKlines.reduce((acc: number, kline: Kline) => {
      const backtestSignals: BacktestSignal[] = kline.algorithms[algorithm]!.signals;
      return acc + backtestSignals.filter((signal: BacktestSignal) => !this.isCloseSignal(signal.signal)).length;
    }, 0);

    this.stats = {
      profit: Number(this.finalProfit[0].toFixed(2)),
      numberOfTrades: tradesCount,
      maxDrawback: Number(this.calcMaxDrawback().toFixed(2)),
    };
  }

  /**
   * max drawback = max percentage drop of profit / highest profit
   */
  private calcMaxDrawback(): number {
    let high = 0, maxDrawback = 0, highestProfit = 0, lowestProfit = 0;

    this.currentKlines.forEach(kline => {
      const profit = kline.algorithms[this.chartService.algorithms[0]]!.percentProfit || 0;
      highestProfit = Math.max(highestProfit, profit);
      lowestProfit = Math.min(lowestProfit, profit);
      high = Math.max(high, profit);
      maxDrawback = Math.max(maxDrawback, high - profit);
    });

    return maxDrawback;
  }

  private setFinalProfits(): void {
    this.finalProfit = [];

    this.chartService.algorithms.forEach((algorithm, index) => {
      this.finalProfit.push(this.currentKlines.at(-1)!.algorithms[this.chartService.algorithms[index]]!.percentProfit || 0);
    });
  }
}