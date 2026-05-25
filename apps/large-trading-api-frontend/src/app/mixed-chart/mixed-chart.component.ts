import { Component, ElementRef, Inject, Input, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { CandlestickData, createChart, IChartApi, ISeriesApi, LineData, MouseEventParams, Time, CrosshairMode, UTCTimestamp, HistogramData, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers, ISeriesMarkersPluginApi, IRange } from 'lightweight-charts';
import { TrendLinesPrimitive } from './primitives/trend-lines-primitive';
import { CompactCirclePrimitive } from './primitives/compact-circle-primitive';
import { WatermarkPrimitive } from './primitives/watermark-primitive';
import { BacktestStats, Kline, Run } from '@shared';
import { ChartService } from '../chart.service';
import { BaseComponent } from '../base-component';
import { IndicatorSeriesService } from './services/indicator-series.service';
import { MarkersChartingService } from './services/markers-charting.service';
import { StatsService } from './services/stats.service';

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
  public currentIndicatorValues: { label: string; value: string }[] = [];
  public stats: BacktestStats;
  public currentKlines: Kline[];

  private chart: IChartApi;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private profitSeries: ISeriesApi<'Line'>[] = [];
  private openPositionSizeSeries: ISeriesApi<'Histogram'> | undefined;
  private trendLinesPrimitive: TrendLinesPrimitive | undefined;
  private compactCirclePrimitive: CompactCirclePrimitive | undefined;
  private watermarkPrimitive: WatermarkPrimitive | undefined;
  private seriesMarkersPlugin: ISeriesMarkersPluginApi<Time> | undefined;
  private commissionChecked: boolean = false;
  private positionSizeChecked: boolean = false;
  private finalProfit: number[] = [];
  private crosshairMoveHandler: ((param: MouseEventParams<Time>) => void) | undefined;
  private visibleRangeChangeHandler: (() => void) | undefined;
  private lastVisibleRangeSize: number | undefined;

  private indicatorSeriesService: IndicatorSeriesService = new IndicatorSeriesService();
  private markersChartingService: MarkersChartingService = new MarkersChartingService();

  constructor(
    public chartService: ChartService,
    public statsService: StatsService,
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
    this.resizeUnlisten?.();

    if (this.crosshairMoveHandler && this.chart) {
      this.chart.unsubscribeCrosshairMove(this.crosshairMoveHandler);
    }

    if (this.visibleRangeChangeHandler && this.chart) {
      this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.visibleRangeChangeHandler);
    }

    if (this.chart) {
      this.chart.remove();
      this.chart = undefined as any;
    }
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
      this.seriesMarkersPlugin!.setMarkers(this.markersChartingService.getMarkersSignals());
    }
  }

  public onShowIndicatorsChange(event: Event): void {
    const checked: boolean = (event.target as HTMLInputElement).checked;
    this.indicatorSeriesService.setVisible(checked);
    if (!checked) this.currentIndicatorValues = [];
  }

  private createChart(): void {
    const container = this.containerRef.nativeElement;
    const width: number = Math.floor(container.getBoundingClientRect().width);
    const height: number = Math.floor(container.getBoundingClientRect().height);

    this.chart = createChart(container, {
      width,
      height,
      leftPriceScale: { visible: !this.chartService.isMulti },
      rightPriceScale: { visible: !this.chartService.isMulti },
      timeScale: { minBarSpacing: 0.001 }
    });

    this.applyDarkTheme(this.chart);
    this.drawSeries();
    this.drawMarkersAndCharting();
    this.subscribeCrosshairMove();
    this.subscribeVisibleRangeChange();
    this.chart.timeScale().fitContent();
  }

  private setKlines(): void {
    this.currentKlines = (this.chartService.isMulti || !this.commissionChecked)
      ? this.klines[0].klines
      : this.klines[1].klines;
    this.watermarkPrimitive?.setConfig(this.currentKlines[0].symbol, this.chartService.exchange, this.chartService.isMulti);
  }

  private resizeUnlisten: (() => void) | undefined;

  private handleResize(): void {
    this.resizeUnlisten = this.renderer.listen('window', 'resize', () => {
      const container = this.containerRef.nativeElement;
      if (this.chart) {
        this.chart.resize(container.clientWidth, container.clientHeight);
      }
    });
  }

  private drawSeries(): void {
    this.indicatorSeriesService.draw(this.chart, this.currentKlines, this.getPositionSizeAlpha());
    this.drawProfitSeries();
    this.initHistogramSeries();
    this.drawCandlestickSeries();
  }

  private initHistogramSeries(): void {
    if (!this.openPositionSizeSeries) {
      this.openPositionSizeSeries = this.chart.addSeries(HistogramSeries, {
        priceScaleId: 'histogram',
        priceLineVisible: false,
        lastValueVisible: false
      });
    }
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
      this.watermarkPrimitive = new WatermarkPrimitive();
      this.candlestickSeries.attachPrimitive(this.watermarkPrimitive);
      this.watermarkPrimitive.setConfig(this.currentKlines[0].symbol, this.chartService.exchange, this.chartService.isMulti);
    }

    const mapped = this.currentKlines.map((kline: Kline) => ({
      time: kline.times.open / 1000 as Time,
      open: kline.prices.open,
      high: kline.prices.high,
      low: kline.prices.low,
      close: kline.prices.close
    }));
    this.candlestickSeries.setData(mapped);
  }

  private drawProfitSeries(): void {
    this.profitSeries.forEach(series => this.chart.removeSeries(series));
    this.profitSeries = [];

    this.chartService.algorithms.forEach((_, index) => {
      const series: ISeriesApi<'Line'> = this.chart.addSeries(LineSeries, {
        priceScaleId: index === 0 ? 'left' : 'left2',
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      this.profitSeries.push(series);
    });

    this.chartService.algorithms.forEach((_, index) => {
      const mapped = this.currentKlines.map((kline: Kline) => {
        const currentProfit: number = kline.algorithms[this.chartService.algorithms[index]]!.percentProfit || 0;
        const opacity: number = index === 0 ? 0.3 : 0.1;
        const color: string = currentProfit === 0
          ? `rgba(255,255,255,${opacity})`
          : currentProfit > 0 ? `rgba(0,255,0,${opacity})` : `rgba(255,77,77,${opacity})`;
        return { time: kline.times.open / 1000 as Time, value: currentProfit, color };
      });
      this.profitSeries[index].setData(mapped);
    });
  }

  private drawMarkersAndCharting(): void {
    this.markersChartingService.drawAll(
      this.currentKlines,
      this.chartService.algorithms[0],
      this.chart,
      this.seriesMarkersPlugin!,
      this.compactCirclePrimitive!,
      this.trendLinesPrimitive,
      this.chartService.isMulti
    );
  }

  private drawOpenPositionSize(): void {
    if (this.positionSizeChecked) {
      this.setOpenPositionSizeSeriesData();
    } else if (this.openPositionSizeSeries) {
      this.openPositionSizeSeries.setData([]);
    }
  }

  private getPositionSizeAlpha(): number {
    const logicalRange = this.chart?.timeScale().getVisibleLogicalRange();
    const numVisibleBars: number = logicalRange ? logicalRange.to - logicalRange.from : 100;
    const chartWidth: number = this.containerRef?.nativeElement?.clientWidth || 1000;
    const barsPerPixel: number = numVisibleBars / chartWidth;
    if (barsPerPixel <= 1) return 0.15;
    // target effective alpha per pixel = 0.15  =>  alpha = 1 - 0.85^(1/barsPerPixel)
    return Math.max(0.01, 1 - Math.pow(0.85, 1 / barsPerPixel));
  }

  private setOpenPositionSizeSeriesData(): void {
    const alpha: number = this.getPositionSizeAlpha();
    const mapped = this.currentKlines.map((kline: Kline) => {
      const openPositionSize: number = kline.algorithms[this.chartService.algorithms[0]]!.openPositionSize!;
      const color: string = openPositionSize === 0
        ? 'transparent'
        : openPositionSize > 0 ? `rgba(0, 255, 162, ${alpha})` : `rgba(255, 0, 170, ${alpha})`;
      return { time: kline.times.open / 1000 as Time, value: openPositionSize, color };
    });

    if (this.openPositionSizeSeries) {
      this.openPositionSizeSeries.setData(mapped);
    }
  }

  private applyDarkTheme(chart: IChartApi): void {
    chart.applyOptions({
      layout: { background: { color: '#1a1a1a' }, textColor: '#FFFFFF' },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.0)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.0)' }
      },
      crosshair: {
        vertLine: { color: '#FFFFFF' },
        horzLine: { color: '#FFFFFF' },
        mode: CrosshairMode.Normal
      }
    });
  }

  private updateStats(): void {
    this.stats = this.statsService.calcStats(this.currentKlines, this.chartService.algorithms[0], this.finalProfit[0]);
  }

  private setFinalProfits(): void {
    this.finalProfit = this.chartService.algorithms.map((_, index) =>
      this.currentKlines.at(-1)!.algorithms[this.chartService.algorithms[index]]!.percentProfit || 0
    );
  }

  private subscribeVisibleRangeChange(): void {
    this.visibleRangeChangeHandler = () => {
      const visibleRange: IRange<Time> | null = this.chart.timeScale().getVisibleRange();
      const logicalRange = this.chart.timeScale().getVisibleLogicalRange();
      const timeRange: number | undefined = visibleRange
        ? (visibleRange.to as UTCTimestamp) - (visibleRange.from as UTCTimestamp)
        : undefined;

      if (timeRange === undefined) return;
      if (this.lastVisibleRangeSize !== undefined && Math.abs(timeRange - this.lastVisibleRangeSize) / this.lastVisibleRangeSize < 0.1) return;

      this.lastVisibleRangeSize = timeRange;
      this.markersChartingService.drawMarkers(this.chart, this.seriesMarkersPlugin!, this.compactCirclePrimitive!, this.chartService.isMulti);

      if (this.openPositionSizeSeries && this.positionSizeChecked) {
        this.setOpenPositionSizeSeriesData();
      }

      this.indicatorSeriesService.setMacdData(this.currentKlines, this.getPositionSizeAlpha());
      this.indicatorSeriesService.setRsiData(logicalRange ? logicalRange.to - logicalRange.from : this.currentKlines.length);
    };

    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.visibleRangeChangeHandler);
  }

  private subscribeCrosshairMove(): void {
    this.crosshairMoveHandler = (param: MouseEventParams<Time>) => {
      const index: number = param.logical as number;
      const kline: Kline = this.currentKlines[index];
      this.updateLegend(param, index);

      if (kline) {
        this.markersChartingService.highlightOpenSignals(kline, this.currentKlines, this.seriesMarkersPlugin!, this.compactCirclePrimitive!, this.chart, this.chartService.isMulti);
      }

      this.markersChartingService.highlightTrendLines(param, this.candlestickSeries, this.trendLinesPrimitive);
    };

    this.chart.subscribeCrosshairMove(this.crosshairMoveHandler);
  }

  private updateLegend(param: MouseEventParams<Time>, index: number): void {
    const ohlc: CandlestickData = param.seriesData.get(this.candlestickSeries) as CandlestickData;

    if (!ohlc) return;

    for (const key in ohlc) {
      if (typeof ohlc[key] === 'number') {
        ohlc[key] = parseFloat(ohlc[key].toFixed(2));
      }
    }

    this.currentOhlc = ohlc;
    this.currentIndex = index;

    this.currentProfit = this.profitSeries.map(series => {
      const data: LineData = param.seriesData.get(series) as LineData;
      return data ? Number(data.value.toFixed(2)) : 0;
    });

    if (this.openPositionSizeSeries) {
      const openPositionSize: HistogramData = param.seriesData.get(this.openPositionSizeSeries) as HistogramData;
      if (openPositionSize) {
        this.openPositionSize = Number(openPositionSize.value.toFixed(2));
      }
    }

    this.currentIndicatorValues = this.indicatorSeriesService.getLegendValues(param);
  }
}
