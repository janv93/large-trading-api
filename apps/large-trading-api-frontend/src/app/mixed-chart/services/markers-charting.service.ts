import { IChartApi, ISeriesApi, SeriesMarker, Time, UTCTimestamp, MouseEventParams } from 'lightweight-charts';
import { Bar, Algorithm, BacktestData, BacktestSignal, Signal, PivotPoint, PivotPointSide, MarketStructureType, TrendLine, TrendLinePosition } from '@shared';
import { TrendLinesPrimitive, TrendLineSegment } from '../primitives/trend-lines-primitive';
import { CompactCirclePrimitive, CompactCircleMarker } from '../primitives/compact-circle-primitive';
import { ISeriesMarkersPluginApi } from 'lightweight-charts';
import { LinearFunction } from '@shared';

export class MarkersChartingService {
  private markersPivotPoints: SeriesMarker<Time>[] = [];
  private markersSignals: SeriesMarker<Time>[] = [];
  private compactSignalMarkers: CompactCircleMarker[] = [];
  private compactPivotPointMarkers: CompactCircleMarker[] = [];
  private currentHighlightedOpenTimes = new Set<number>();

  public drawAll(
    bars: Bar[],
    algorithm: Algorithm,
    chart: IChartApi,
    seriesMarkersPlugin: ISeriesMarkersPluginApi<Time>,
    compactCirclePrimitive: CompactCirclePrimitive,
    trendLinesPrimitive: TrendLinesPrimitive | undefined,
    isMulti: boolean
  ): void {
    this.setPivotPointMarkers(bars);
    this.setSignalMarkers(bars, algorithm);
    this.drawMarkers(chart, seriesMarkersPlugin, compactCirclePrimitive, isMulti);
    this.setTrendLines(bars, trendLinesPrimitive);
  }

  public drawMarkers(
    chart: IChartApi,
    seriesMarkersPlugin: ISeriesMarkersPluginApi<Time>,
    compactCirclePrimitive: CompactCirclePrimitive,
    isMulti: boolean
  ): void {
    const threshold: number = isMulti ? 50 : 200;

    if (this.getVisibleMarkersCount(chart) > threshold) {
      const combinedCompactMarkers: CompactCircleMarker[] = [...this.compactSignalMarkers, ...this.compactPivotPointMarkers];
      combinedCompactMarkers.sort((a, b) => a.time - b.time);
      seriesMarkersPlugin.setMarkers([]);
      compactCirclePrimitive.setMarkers(combinedCompactMarkers);
    } else {
      const allMarkers: SeriesMarker<Time>[] = [...this.markersSignals, ...this.markersPivotPoints];
      allMarkers.sort((a, b) => (a.time as UTCTimestamp) - (b.time as UTCTimestamp));
      seriesMarkersPlugin.setMarkers(allMarkers);
      compactCirclePrimitive.setMarkers([]);
    }
  }

  public getMarkersSignals(): SeriesMarker<Time>[] {
    return this.markersSignals;
  }

  public highlightOpenSignals(
    bar: Bar,
    bars: Bar[],
    seriesMarkersPlugin: ISeriesMarkersPluginApi<Time>,
    compactCirclePrimitive: CompactCirclePrimitive,
    chart: IChartApi,
    isMulti: boolean
  ): void {
    const backtest: BacktestData = bar.algorithms[Object.keys(bar.algorithms)[0]]!;

    const newOpenTimes: Set<number> = new Set(
      backtest.signals.flatMap(signal =>
        signal.openSignalReferences?.map(ref => bars[ref.barIndex].times.open) ?? []
      )
    );

    const changed: boolean =
      newOpenTimes.size !== this.currentHighlightedOpenTimes.size ||
      [...newOpenTimes].some(t => !this.currentHighlightedOpenTimes.has(t));

    if (!changed) return;

    this.currentHighlightedOpenTimes = newOpenTimes;

    this.markersSignals.forEach((marker: SeriesMarker<Time>) => {
      marker.size = newOpenTimes.has((marker.time as UTCTimestamp) * 1000) ? 3 : undefined;
    });

    this.drawMarkers(chart, seriesMarkersPlugin, compactCirclePrimitive, isMulti);
  }

  public highlightTrendLines(
    param: MouseEventParams<Time>,
    trendLinesPrimitive: TrendLinesPrimitive | undefined
  ): void {
    if (!trendLinesPrimitive) return;

    if (!param?.point || !param.logical) {
      trendLinesPrimitive.setHover(null, null);
      return;
    }

    trendLinesPrimitive.setHover(param.point.x, param.point.y);
  }

  private setPivotPointMarkers(bars: Bar[]): void {
    const markers: SeriesMarker<Time>[] = [];
    const compactMarkers: CompactCircleMarker[] = [];

    bars.forEach((bar: Bar) => {
      if (!bar.chart?.pivotPoint) return;
      const marker: SeriesMarker<Time> = this.getPivotPointTemplate(bar);
      markers.push(marker);
      compactMarkers.push({
        time: bar.times.open / 1000,
        price: marker.position === 'belowBar' ? bar.prices.low : bar.prices.high,
        side: marker.position === 'belowBar' ? 'below' : 'above',
        color: marker.color as string
      });
    });

    this.markersPivotPoints = markers;
    this.compactPivotPointMarkers = compactMarkers;
  }

  private setSignalMarkers(bars: Bar[], algorithm: Algorithm): void {
    const markers: SeriesMarker<Time>[] = [];
    const compactMarkers: CompactCircleMarker[] = [];

    bars.forEach((bar: Bar) => {
      if (!bar.algorithms[algorithm]?.signals.length) return;
      const marker: SeriesMarker<Time> = this.getSignalTemplate(bar, algorithm);
      markers.push(marker);
      compactMarkers.push({
        time: bar.times.open / 1000,
        price: marker.position === 'belowBar' ? bar.prices.low : bar.prices.high,
        side: marker.position === 'belowBar' ? 'below' : 'above',
        color: marker.color as string
      });
    });

    this.markersSignals = markers;
    this.compactSignalMarkers = compactMarkers;
  }

  private setTrendLines(bars: Bar[], trendLinesPrimitive: TrendLinesPrimitive | undefined): void {
    if (!trendLinesPrimitive) return;
    const segments: TrendLineSegment[] = [];

    bars.forEach((bar: Bar) => {
      if (!bar.chart?.trendLines?.length) return;

      bar.chart.trendLines.forEach((trendLine: TrendLine) => {
        const startValue: number = trendLine.position === TrendLinePosition.Above ? bar.prices.high : bar.prices.low;
        const endBar: Bar = bars[trendLine.endIndex];
        let endTime: number;
        let endValue: number;

        if (trendLine.breakThroughIndex) {
          const breakthroughBar: Bar = bars[trendLine.breakThroughIndex];
          const lineFunction: LinearFunction = new LinearFunction(trendLine.function.m, trendLine.function.b);
          endTime = breakthroughBar.times.open / 1000;
          endValue = lineFunction.getY(trendLine.breakThroughIndex);
        } else {
          endTime = endBar.times.open / 1000;
          endValue = trendLine.position === TrendLinePosition.Above ? endBar.prices.high : endBar.prices.low;
        }

        segments.push({
          startTime: bar.times.open / 1000,
          startValue,
          endTime,
          endValue,
          startIndex: trendLine.startIndex,
          endIndex: trendLine.breakThroughIndex ?? trendLine.endIndex
        });
      });
    });

    trendLinesPrimitive.setSegments(segments);
  }

  private getVisibleMarkersCount(chart: IChartApi): number {
    const visibleRange = chart.timeScale().getVisibleRange();

    const isInRange = (marker: SeriesMarker<Time>): boolean => {
      const time: UTCTimestamp = marker.time as UTCTimestamp;
      return time >= (visibleRange!.from as UTCTimestamp) && time <= (visibleRange!.to as UTCTimestamp);
    };

    return this.markersSignals.filter(isInRange).length + this.markersPivotPoints.filter(isInRange).length;
  }

  private getSignalTemplate(bar: Bar, algorithm: Algorithm): SeriesMarker<Time> {
    const backtest: BacktestData = bar.algorithms[algorithm]!;
    const backtestSignals: BacktestSignal[] = backtest.signals;
    const signals: Signal[] = backtestSignals.map((s: BacktestSignal) => s.signal);
    const hasBuy: boolean = signals.includes(Signal.Buy);
    const hasSell: boolean = signals.includes(Signal.Sell);
    const hasClose: boolean = signals.includes(Signal.Close) || signals.includes(Signal.CloseAll);
    const hasLiquidation: boolean = signals.includes(Signal.Liquidation);
    const hasTakeProfit: boolean = signals.includes(Signal.TakeProfit);
    const hasStopLoss: boolean = signals.includes(Signal.StopLoss);
    const hasForceClose: boolean = hasLiquidation || hasTakeProfit || hasStopLoss;
    const hasMultipleForceClose: boolean = [hasLiquidation, hasTakeProfit, hasStopLoss].filter(v => v).length > 1;
    const isBuy: string | undefined = hasBuy && !hasSell && !hasClose && !hasForceClose ? 'BUY' : undefined;
    const isSell: string | undefined = hasSell && !hasBuy && !hasClose && !hasForceClose ? 'SELL' : undefined;
    const isClose: string | undefined = !hasBuy && !hasSell && !hasForceClose ? 'CLOSE' : undefined;
    const isLiquidation: string | undefined = hasLiquidation && !hasMultipleForceClose && !hasClose && !hasBuy && !hasSell ? 'LIQ' : undefined;
    const isTakeProfit: string | undefined = hasTakeProfit && !hasMultipleForceClose && !hasClose && !hasBuy && !hasSell ? 'TP' : undefined;
    const isStopLoss: string | undefined = hasStopLoss && !hasMultipleForceClose && !hasClose && !hasBuy && !hasSell ? 'SL' : undefined;
    const isCloseBuy: string | undefined = (hasClose || hasForceClose) && !hasMultipleForceClose && hasBuy && !hasSell ? 'CBUY' : undefined;
    const isCloseSell: string | undefined = (hasClose || hasForceClose) && !hasMultipleForceClose && hasSell && !hasBuy ? 'CSELL' : undefined;
    const isMix: string | undefined = (hasBuy && hasSell) || (hasClose && hasForceClose) || hasMultipleForceClose ? 'MIX' : undefined;
    const signal: string = (isBuy || isSell || isClose || isLiquidation || isTakeProfit || isStopLoss || isCloseBuy || isCloseSell || isMix)!;

    const totalSize: number = backtestSignals.reduce((acc: number, s: BacktestSignal) => {
      return this.isCloseSignal(s.signal) ? acc : acc + s.size!;
    }, 0);

    return {
      time: bar.times.open / 1000 as Time,
      position: ['BUY', 'CBUY'].includes(signal) ? 'belowBar' : 'aboveBar',
      color: ['BUY', 'CBUY'].includes(signal) ? 'lime' : ['CLOSE', 'LIQ', 'TP', 'SL', 'MIX'].includes(signal) ? 'white' : '#ffd500',
      shape: ['BUY', 'CBUY'].includes(signal) ? 'arrowUp' : 'arrowDown',
      text: signal + (totalSize ? ` ${totalSize.toFixed(2)}` : '')
    };
  }

  private getPivotPointTemplate(bar: Bar): SeriesMarker<Time> {
    const pivotPoint: PivotPoint = bar.chart?.pivotPoint!;
    const marketStructure: MarketStructureType | undefined = pivotPoint.marketStructure;

    return {
      time: bar.times.open / 1000 as Time,
      position: pivotPoint.side === PivotPointSide.High ? 'aboveBar' : 'belowBar',
      color: 'white',
      shape: pivotPoint.side === PivotPointSide.High ? 'arrowDown' : 'arrowUp',
      text: marketStructure ? marketStructure : 'PP'
    };
  }

  private isCloseSignal(signal?: Signal): boolean {
    if (!signal) return false;
    return [Signal.CloseAll, Signal.Close, Signal.Liquidation, Signal.TakeProfit, Signal.StopLoss].includes(signal);
  }
}
