import { Component, ElementRef, Inject, Input, OnDestroy, OnInit, Renderer2, ViewChild, signal } from '@angular/core';
import { CandlestickData, createChart, IChartApi, ISeriesApi, LineData, MouseEventParams, SeriesMarker, Time, CrosshairMode, UTCTimestamp, HistogramData, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers, ISeriesMarkersPluginApi } from 'lightweight-charts';
import { TrendLinesPrimitive, TrendLineSegment } from './trend-lines-primitive';
import { CompactCirclePrimitive, CompactCircleMarker } from './compact-circle-primitive';
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
  public currentProfit: number[];
  public currentIndex: number;
  public openPositionSize: number;
  public stats: BacktestStats;
  public currentKlines: Kline[];
  private chart: IChartApi;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private profitSeries: ISeriesApi<'Line'>[] = [];
  private openPositionSizeSeries: ISeriesApi<'Histogram'> | undefined;
  private trendLinesPrimitive: TrendLinesPrimitive | undefined;
  private compactCirclePrimitive: CompactCirclePrimitive | undefined;
  private compactMarkers: CompactCircleMarker[] = [];
  private compactPivotMarkers: CompactCircleMarker[] = [];
  private commissionChecked = false;
  private positionSizeChecked = false;
  private finalProfit: number[] = [];
  private markersPivotPoints: SeriesMarker<Time>[] = [];
  private markersSignals: SeriesMarker<Time>[] = [];
  private crosshairMoveHandler: ((param: MouseEventParams<Time>) => void) | undefined;
  private visibleRangeChangeHandler: (() => void) | undefined;
  private currentHighlightedOpenTimes = new Set<number>();
  private seriesMarkersPlugin: ISeriesMarkersPluginApi<Time> | undefined;

  constructor(
    public chartService: ChartService,
    @Inject(Renderer2) private renderer: Renderer2
  ) {
    super();
  }

  ngOnInit(): void {
    this.setKlines();
    this.setFinalProfits();
    this.updateStats();
    this.handleResize();
  }

  ngAfterViewInit(): void {
    this.createChart();
  }

  ngOnDestroy(): void {
    if (this.crosshairMoveHandler && this.chart) {
      this.chart.unsubscribeCrosshairMove(this.crosshairMoveHandler);
    }

    if (this.visibleRangeChangeHandler && this.chart) {
      this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.visibleRangeChangeHandler);
    }

    if (this.chart) {
      this.chart.remove();
    }
  }

  public getDrawbackColor(value: number, maxGreen: number, maxRed: number): string {
    if (value < 0) {
      return 'rgb(255, 77, 77)';
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

  public onCommissionChange(event: Event): void {
    this.commissionChecked = (event.target as HTMLInputElement).checked;
    this.setKlines();
    this.setFinalProfits();
    this.updateStats();
    this.drawSeries();
    this.drawMarkersAndCharting();
  }

  public onShowPositionSizeChange(event: Event): void {
    const checked: boolean = (event.target as HTMLInputElement).checked;
    this.positionSizeChecked = checked;
    this.drawOpenPositionSize();
  }

  public onShowChartingChange(event: Event): void {
    const checked: boolean = (event.target as HTMLInputElement).checked;

    if (checked) {
      this.drawMarkersAndCharting();
    } else {
      this.trendLinesPrimitive?.setSegments([]);
      this.seriesMarkersPlugin!.setMarkers(this.markersSignals);
    }
  }

  private createChart(): void {
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

    this.applyDarkTheme(this.chart);
    this.drawSeries();
    this.drawMarkersAndCharting();
    this.subscribeCrosshairMove();
    this.subscribeVisibleRangeChange();
    this.chart.timeScale().fitContent();
  }

  private setKlines(): void {
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

  private handleResize(): void {
    this.renderer.listen('window', 'resize', () => {
      const container = this.containerRef.nativeElement;

      if (this.chart) {
        this.chart.resize(container.clientWidth, container.clientHeight);
      }
    });
  }

  private drawSeries(): void {
    this.drawProfitSeries();
    this.drawCandlestickSeries();
  }

  private drawCandlestickSeries(): void {
    if (!this.candlestickSeries) {
      this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
        priceScaleId: 'right',
        priceLineVisible: false,
        lastValueVisible: false
      });

      this.seriesMarkersPlugin = createSeriesMarkers(this.candlestickSeries, []);
      this.trendLinesPrimitive = new TrendLinesPrimitive();
      this.candlestickSeries.attachPrimitive(this.trendLinesPrimitive);
      this.compactCirclePrimitive = new CompactCirclePrimitive();
      this.candlestickSeries.attachPrimitive(this.compactCirclePrimitive);
    }

    this.setCandlestickSeriesData();
  }

  private drawProfitSeries(): void {
    this.clearProfitSeries();
    this.createAndConfigureProfitSeries();
    this.setProfitSeriesData();
  }

  private clearProfitSeries(): void {
    this.profitSeries.forEach(series => this.chart.removeSeries(series));
    this.profitSeries = [];
  }

  private createAndConfigureProfitSeries(): void {
    this.chartService.algorithms.forEach((_, index) => {
      const series = this.chart.addSeries(LineSeries, {
        priceScaleId: index === 0 ? 'left' : 'left2',
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });

      this.profitSeries.push(series);
    });
  }

  private drawOpenPositionSize(): void {
    if (this.positionSizeChecked) {
      if (this.openPositionSizeSeries) {
        this.chart.removeSeries(this.openPositionSizeSeries);
      }

      this.openPositionSizeSeries = this.chart.addSeries(HistogramSeries, { priceScaleId: 'histogram' });
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

  private drawMarkersAndCharting(): void {
    this.setPivotPointsMarkers();
    this.setSignalsMarkers();
    this.setTrendLines();
  }

  private setPivotPointsMarkers(): void {
    const markers: SeriesMarker<Time>[] = [];
    const compactPivotMarkers: CompactCircleMarker[] = [];

    this.currentKlines.forEach((kline: Kline) => {
      if (kline.chart?.pivotPoints) {
        const marker = this.getPivotPointTemplate(kline);
        markers.push(marker);
        compactPivotMarkers.push({
          time: kline.times.open / 1000,
          price: marker.position === 'belowBar' ? kline.prices.low : kline.prices.high,
          side: marker.position === 'belowBar' ? 'below' : 'above',
          color: marker.color as string
        });
      }
    });

    this.markersPivotPoints = markers;
    this.compactPivotMarkers = compactPivotMarkers;
    this.drawMarkers();
  }

  private setTrendLines(): void {
    const segments: TrendLineSegment[] = [];

    this.currentKlines.forEach((kline: Kline) => {
      if (!kline.chart?.trendLines?.length) return;

      kline.chart.trendLines.forEach((trendLine: TrendLine) => {
        const startValue = trendLine.position === TrendLinePosition.Above ? kline.prices.high : kline.prices.low;
        const endKline: Kline = this.currentKlines[trendLine.endIndex];
        let endTime: number;
        let endValue: number;

        if (trendLine.breakThroughIndex) {
          const breakthroughKline: Kline = this.currentKlines[trendLine.breakThroughIndex];
          const lineFunction = new LinearFunction(trendLine.function.m, trendLine.function.b);
          endTime = breakthroughKline.times.open / 1000;
          endValue = lineFunction.getY(trendLine.breakThroughIndex);
        } else {
          endTime = endKline.times.open / 1000;
          endValue = trendLine.position === TrendLinePosition.Above ? endKline.prices.high : endKline.prices.low;
        }

        segments.push({
          startTime: kline.times.open / 1000,
          startValue,
          endTime,
          endValue,
          startIndex: trendLine.startIndex,
          endIndex: trendLine.breakThroughIndex ?? trendLine.endIndex
        });
      });
    });

    this.trendLinesPrimitive?.setSegments(segments);
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

  private setSignalsMarkers(): void {
    const markers: SeriesMarker<Time>[] = [];
    const compactMarkers: CompactCircleMarker[] = [];

    this.currentKlines.forEach((kline: Kline) => {
      if (kline.algorithms[this.chartService.algorithms[0]]!.signals.length) {
        const marker = this.getSignalTemplate(kline);
        markers.push(marker);
        compactMarkers.push({
          time: kline.times.open / 1000,
          price: marker.position === 'belowBar' ? kline.prices.low : kline.prices.high,
          side: marker.position === 'belowBar' ? 'below' : 'above',
          color: marker.color as string
        });
      }
    });

    this.markersSignals = markers;
    this.compactMarkers = compactMarkers;
    this.drawMarkers();
  }

  // combine all markers
  private drawMarkers(): void {
    if (this.getVisibleSignalsCount() > 500) {
      this.seriesMarkersPlugin!.setMarkers([]);
      this.compactCirclePrimitive!.setMarkers([...this.compactMarkers, ...this.compactPivotMarkers]);
    } else {
      const allMarkers = [...this.markersSignals, ...this.markersPivotPoints];
      allMarkers.sort((a, b) => (a.time as UTCTimestamp) - (b.time as UTCTimestamp));
      this.seriesMarkersPlugin!.setMarkers(allMarkers);
      this.compactCirclePrimitive!.setMarkers([]);
    }
  }

  private getVisibleSignalsCount(): number {
    const visibleRange = this.chart?.timeScale().getVisibleRange();

    return this.markersSignals.filter(m => {
      const t = m.time as UTCTimestamp;
      return t >= (visibleRange!.from as UTCTimestamp) && t <= (visibleRange!.to as UTCTimestamp);
    }).length;
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
    const isMix: string | undefined = (hasBuy && hasSell) || (hasClose && hasForceClose) || hasMultipleForceClose ? 'MIX' : undefined;
    let signal: string = (isBuy || isSell || isClose || isLiquidation || isTakeProfit || isStopLoss || isCloseBuy || isCloseSell || isMix)!;

    // sum up sizes of all signals of this kline
    const totalSize: number = backtestSignals.reduce((acc: number, signal: BacktestSignal) => {
      const isCloseSignal: boolean = this.isCloseSignal(signal.signal);
      return isCloseSignal ? acc : acc + signal.size!;
    }, 0);

    return {
      time: kline.times.open / 1000 as Time,
      position: ['BUY', 'CBUY'].includes(signal) ? 'belowBar' : 'aboveBar',
      color: ['BUY', 'CBUY'].includes(signal) ? 'lime' : ['CLOSE', 'LIQ', 'TP', 'SL', 'MIX'].includes(signal) ? 'white' : '#ffd500',
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

  private setProfitSeriesData(): void {
    this.chartService.algorithms.forEach((_, index) => {
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
    });
  }

  private setOpenPositionSizeSeriesData(): void {
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

  private applyDarkTheme(chart: IChartApi): void {
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

  private subscribeVisibleRangeChange(): void {
    this.visibleRangeChangeHandler = () => {
      this.drawMarkers();
    };

    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.visibleRangeChangeHandler);
  }

  private subscribeCrosshairMove(): void {
    this.crosshairMoveHandler = (param: MouseEventParams<Time>) => {
      const index: number = param.logical as number;
      const kline: Kline = this.currentKlines[index];
      this.updateLegend(param, index);

      if (kline) {
        this.highlightOpenSignals(kline);
      }

      this.highlightTrendLines(param);
    };

    this.chart.subscribeCrosshairMove(this.crosshairMoveHandler);
  }

  private updateLegend(param: MouseEventParams<Time>, index: number): void {
    const ohlc = param.seriesData.get(this.candlestickSeries) as CandlestickData;

    if (!ohlc) return;

    for (const key in ohlc) {
      if (typeof ohlc[key] === 'number') {
        ohlc[key] = parseFloat(ohlc[key].toFixed(2));
      }
    }

    this.currentOhlc = ohlc;
    this.currentIndex = index;

    this.currentProfit = this.profitSeries.map(series => {
      const data = param.seriesData.get(series) as LineData;
      return data ? Number(data.value.toFixed(2)) : 0;
    });

    if (this.openPositionSizeSeries) {
      const openPositionSize = param.seriesData.get(this.openPositionSizeSeries) as HistogramData;

      if (openPositionSize) {
        this.openPositionSize = Number(openPositionSize.value.toFixed(2));
      }
    }
  }

  private highlightOpenSignals(kline: Kline): void {
    const backtest: BacktestData = kline.algorithms[this.chartService.algorithms[0]]!;

    const newOpenTimes = new Set(
      backtest.signals.flatMap(s => s.openSignalReferences?.map(r => r.openTime) ?? [])
    );

    const changed: boolean = newOpenTimes.size !== this.currentHighlightedOpenTimes.size ||
      [...newOpenTimes].some(t => !this.currentHighlightedOpenTimes.has(t));

    if (!changed) return;

    this.currentHighlightedOpenTimes = newOpenTimes;

    this.markersSignals.forEach((marker: SeriesMarker<Time>) => {
      marker.size = newOpenTimes.has((marker.time as UTCTimestamp) * 1000) ? 3 : undefined;
    });

    this.drawMarkers();
  }

  private highlightTrendLines(param: MouseEventParams<Time>): void {
    if (!this.trendLinesPrimitive) return;

    if (!param?.point || !param.logical) {
      this.trendLinesPrimitive.setHover(null, null);
      return;
    }

    const hoverPrice: number = this.candlestickSeries.coordinateToPrice(param.point.y) as number;
    const index: number = param.logical as number;
    this.trendLinesPrimitive.setHover(index, hoverPrice);
  }

  private updateStats(): void {
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