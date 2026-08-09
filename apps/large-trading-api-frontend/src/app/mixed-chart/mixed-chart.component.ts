import { Component, ElementRef, Inject, Input, OnChanges, OnDestroy, OnInit, Renderer2, signal, SimpleChanges, ViewChild } from '@angular/core';
import { CandlestickData, createChart, IChartApi, ISeriesApi, LineData, MouseEventParams, Time, CrosshairMode, UTCTimestamp, HistogramData, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers, ISeriesMarkersPluginApi, IRange, TickMarkType } from 'lightweight-charts';
import { TrendLinesPrimitive } from './primitives/trend-lines-primitive';
import { CompactCirclePrimitive } from './primitives/compact-circle-primitive';
import { WatermarkPrimitive } from './primitives/watermark-primitive';
import { BacktestStats, Bar, Run } from '@shared';
import { ChartConfig, getStrategies, isMultiConfig } from '../chart-config/chart-config';
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
export class MixedChartComponent extends BaseComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('container') containerRef: ElementRef;
  @ViewChild('legend') legend: ElementRef;
  @Input() runs: Run[];
  @Input() hasCommission: boolean = false;
  @Input() showPositionSize: boolean = false;
  @Input() showCharting: boolean = true;
  @Input() showIndicators: boolean = true;
  @Input() config: ChartConfig;

  public readonly chartHovered = signal(false);
  public readonly currentOhlc = signal<CandlestickData | undefined>(undefined);
  public readonly currentProfit = signal<number[]>([]);
  public readonly currentIndex = signal<number | undefined>(undefined);
  public readonly openPositionSize = signal<number | undefined>(undefined);
  public readonly currentIndicatorValues = signal<{ label: string; value: string }[]>([]);
  public stats: BacktestStats;
  public currentBars: Bar[];

  private chart: IChartApi;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private profitSeries: ISeriesApi<'Line'>[] = [];
  private openPositionSizeSeries: ISeriesApi<'Histogram'> | undefined;
  private trendLinesPrimitive: TrendLinesPrimitive | undefined;
  private compactCirclePrimitive: CompactCirclePrimitive | undefined;
  private watermarkPrimitive: WatermarkPrimitive | undefined;
  private seriesMarkersPlugin: ISeriesMarkersPluginApi<Time> | undefined;
  private positionSizeChecked: boolean = false;
  private finalProfit: number[] = [];
  private crosshairMoveHandler: ((param: MouseEventParams<Time>) => void) | undefined;
  private visibleRangeChangeHandler: (() => void) | undefined;
  private lastVisibleRangeSize: number | undefined;

  private readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  private indicatorSeriesService: IndicatorSeriesService = new IndicatorSeriesService();
  private markersChartingService: MarkersChartingService = new MarkersChartingService();

  constructor(
    public statsService: StatsService,
    @Inject(Renderer2) private renderer: Renderer2
  ) {
    super();
  }

  public get isMulti(): boolean {
    return isMultiConfig(this.config);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hasCommission'] && this.chart) {
      this.setBars();
      this.setFinalProfits();
      this.updateStats();
      this.drawSeries();
      this.applyDisplayOptions();
    }
    if (changes['showPositionSize']) this.positionSizeChecked = this.showPositionSize;
    if (this.chart && (changes['showPositionSize'] || changes['showCharting'] || changes['showIndicators'])) this.applyDisplayOptions();
  }

  ngOnInit(): void {
    this.setBars();
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

  private applyDisplayOptions(): void {
    this.positionSizeChecked = this.showPositionSize;
    this.drawOpenPositionSize();

    if (this.showCharting) {
      this.drawMarkersAndCharting();
    } else {
      this.trendLinesPrimitive?.setSegments([]);
      this.seriesMarkersPlugin!.setMarkers(this.markersChartingService.getMarkersSignals());
    }

    this.indicatorSeriesService.setVisible(this.showIndicators);
    if (!this.showIndicators) this.currentIndicatorValues.set([]);
  }

  private createChart(): void {
    const container = this.containerRef.nativeElement;
    const width: number = Math.floor(container.getBoundingClientRect().width);
    const height: number = Math.floor(container.getBoundingClientRect().height);

    this.chart = createChart(container, {
      width,
      height,
      leftPriceScale: { visible: !this.isMulti },
      rightPriceScale: { visible: !this.isMulti },
      timeScale: { minBarSpacing: 0.001, timeVisible: true }
    });

    this.applyDarkTheme(this.chart);
    this.drawSeries();
    this.applyDisplayOptions();
    this.subscribeCrosshairMove();
    this.subscribeVisibleRangeChange();
    this.chart.timeScale().fitContent();
  }

  private setBars(): void {
    this.currentBars = this.hasCommission
      ? this.runs[1].bars
      : this.runs[0].bars;
    this.watermarkPrimitive?.setConfig(this.currentBars[0].symbol, this.currentBars[0].exchange, this.isMulti);
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
    this.indicatorSeriesService.draw(this.chart, this.currentBars, this.getPositionSizeAlpha());
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
      this.watermarkPrimitive.setConfig(this.currentBars[0].symbol, this.currentBars[0].exchange, this.isMulti);
    }

    const mapped = this.currentBars.map((bar: Bar) => ({
      time: bar.times.open / 1000 as Time,
      open: bar.prices.open,
      high: bar.prices.high,
      low: bar.prices.low,
      close: bar.prices.close
    }));
    this.candlestickSeries.setData(mapped);
  }

  private drawProfitSeries(): void {
    this.profitSeries.forEach(series => this.chart.removeSeries(series));
    this.profitSeries = [];

    getStrategies(this.config).forEach((_, index) => {
      const series: ISeriesApi<'Line'> = this.chart.addSeries(LineSeries, {
        priceScaleId: index === 0 ? 'left' : 'left2',
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      this.profitSeries.push(series);
    });

    getStrategies(this.config).forEach((selection, index) => {
      const mapped = this.currentBars.map((bar: Bar) => {
        const currentProfit: number = (bar.backtests[selection.strategy]!.profit || 0) * 100;
        const opacity: number = index === 0 ? 0.3 : 0.1;
        const color: string = currentProfit === 0
          ? `rgba(255,255,255,${opacity})`
          : currentProfit > 0 ? `rgba(0,255,0,${opacity})` : `rgba(255,77,77,${opacity})`;
        return { time: bar.times.open / 1000 as Time, value: currentProfit, color };
      });
      this.profitSeries[index].setData(mapped);
    });
  }

  private drawMarkersAndCharting(): void {
    this.markersChartingService.drawAll(
      this.currentBars,
      this.config.mainStrategy.strategy,
      this.chart,
      this.seriesMarkersPlugin!,
      this.compactCirclePrimitive!,
      this.trendLinesPrimitive,
      this.isMulti
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
    const mapped = this.currentBars.map((bar: Bar) => {
      const openPositionSize: number = bar.backtests[this.config.mainStrategy.strategy]!.openPositionSize!;
      const color: string = openPositionSize === 0
        ? 'transparent'
        : openPositionSize > 0 ? `rgba(0, 255, 162, ${alpha})` : `rgba(255, 0, 170, ${alpha})`;
      return { time: bar.times.open / 1000 as Time, value: openPositionSize, color };
    });

    if (this.openPositionSizeSeries) {
      this.openPositionSizeSeries.setData(mapped);
    }
  }

  public formatBarTime(time: Time): string {
    return this.formatTimeByTimeframe(time as UTCTimestamp);
  }

  private formatTimeByTimeframe(time: UTCTimestamp): string {
    const unit = this.config.timeframe.slice(-1);
    const date = new Date(time * 1000);
    const day = date.getDate().toString().padStart(2, '0');
    const month = this.months[date.getMonth()];
    const year = date.getFullYear();
    if (unit === 'm') {
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${day} ${month} ${year} ${h}:${m}`;
    } else if (unit === 'h') {
      const h = date.getHours().toString().padStart(2, '0');
      return `${day} ${month} ${year} ${h}:00`;
    }
    return `${day} ${month} ${year}`;
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
      },
      localization: {
        timeFormatter: (time: UTCTimestamp) => this.formatTimeByTimeframe(time),
        priceFormatter: (price: number) => {
          if (price >= 1000 && price % 1000 === 0) return (price / 1000) + 'k';
          if (price % 1 === 0) return price.toFixed(0);
          return price.toFixed(2);
        }
      },
      timeScale: {
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
          const ts = time as UTCTimestamp;
          const date = new Date(ts * 1000);
          const unit = this.config.timeframe.slice(-1);
          if (tickMarkType === TickMarkType.Year) return date.getFullYear().toString();
          if (tickMarkType === TickMarkType.Month) return `${this.months[date.getMonth()]} ${date.getFullYear()}`;
          if (tickMarkType === TickMarkType.DayOfMonth) return `${date.getDate()} ${this.months[date.getMonth()]}`;
          const h = date.getHours().toString().padStart(2, '0');
          const m = date.getMinutes().toString().padStart(2, '0');
          return unit === 'm' ? `${h}:${m}` : `${h}:00`;
        }
      }
    });
  }

  private updateStats(): void {
    this.stats = this.statsService.calcStats(this.currentBars, this.config.mainStrategy.strategy, this.finalProfit[0]);
  }

  private setFinalProfits(): void {
    const finalBar = this.currentBars.at(-1)!;
    this.finalProfit = getStrategies(this.config).map(selection =>
      (finalBar.backtests[selection.strategy]!.profit || 0) * 100
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
      if (this.showCharting) {
        this.markersChartingService.drawMarkers(this.chart, this.seriesMarkersPlugin!, this.compactCirclePrimitive!, this.isMulti);
      }

      if (this.openPositionSizeSeries && this.positionSizeChecked) {
        this.setOpenPositionSizeSeriesData();
      }

      this.indicatorSeriesService.setMacdData(this.currentBars, this.getPositionSizeAlpha());
      this.indicatorSeriesService.setRsiData(logicalRange ? logicalRange.to - logicalRange.from : this.currentBars.length);
    };

    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.visibleRangeChangeHandler);
  }

  private subscribeCrosshairMove(): void {
    this.crosshairMoveHandler = (param: MouseEventParams<Time>) => {
      const index: number = param.logical as number;
      const bar: Bar = this.currentBars[index];
      this.indicatorSeriesService.setRsiHover(param.hoveredSeries === this.indicatorSeriesService.getRsiSeries());
      this.updateLegend(param, index);

      if (bar && this.showCharting) {
        this.markersChartingService.highlightOpenSignals(bar, this.currentBars, this.seriesMarkersPlugin!, this.compactCirclePrimitive!, this.chart, this.isMulti);
      }

      if (this.showCharting) {
        this.markersChartingService.highlightTrendLines(param, this.trendLinesPrimitive);
      }
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

    this.currentOhlc.set(ohlc);
    this.currentIndex.set(index);

    this.currentProfit.set(this.profitSeries.map(series => {
      const data: LineData = param.seriesData.get(series) as LineData;
      return data ? Number(data.value.toFixed(2)) : 0;
    }));

    if (this.openPositionSizeSeries) {
      const openPositionSize: HistogramData = param.seriesData.get(this.openPositionSizeSeries) as HistogramData;
      if (openPositionSize) {
        this.openPositionSize.set(Number(openPositionSize.value.toFixed(2)));
      }
    }

    this.currentIndicatorValues.set(this.showIndicators ? this.indicatorSeriesService.getLegendValues(param) : []);
  }
}
