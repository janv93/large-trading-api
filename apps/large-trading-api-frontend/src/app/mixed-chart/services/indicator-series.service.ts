import { IChartApi, ISeriesApi, LineSeries, HistogramSeries, LineData, HistogramData, MouseEventParams, Time } from 'lightweight-charts';
import { Bar } from '@shared';

export class IndicatorSeriesService {
  private emaSeries: Map<number, ISeriesApi<'Line'>> = new Map();
  private smaSeries: Map<number, ISeriesApi<'Line'>> = new Map();
  private bbSeries: { upper: ISeriesApi<'Line'>; middle: ISeriesApi<'Line'>; lower: ISeriesApi<'Line'> } | undefined;
  private rsiSeries: ISeriesApi<'Line'> | undefined;
  private rsiBars: Bar[] = [];
  private rsiHovered: boolean = false;
  private atrSeries: ISeriesApi<'Line'> | undefined;
  private macdHistogramSeries: ISeriesApi<'Histogram'> | undefined;

  public draw(chart: IChartApi, bars: Bar[], macdAlpha: number): void {
    const emaPeriods: Set<number> = new Set<number>();
    const smaPeriods: Set<number> = new Set<number>();
    let hasRsi: boolean = false;
    let hasAtr: boolean = false;
    let hasMacd: boolean = false;
    let hasBb: boolean = false;

    bars.forEach((bar: Bar) => {
      if (!bar.indicators) return;
      if (bar.indicators.ema) Object.keys(bar.indicators.ema).forEach(p => emaPeriods.add(Number(p)));
      if (bar.indicators.sma) Object.keys(bar.indicators.sma).forEach(p => smaPeriods.add(Number(p)));
      if (bar.indicators.rsi !== undefined) hasRsi = true;
      if (bar.indicators.atr !== undefined) hasAtr = true;
      if (bar.indicators.macd) hasMacd = true;
      if (bar.indicators.bb) hasBb = true;
    });

    // remove series for indicators/periods no longer present
    this.emaSeries.forEach((series, period) => {
      if (!emaPeriods.has(period)) { chart.removeSeries(series); this.emaSeries.delete(period); }
    });
    this.smaSeries.forEach((series, period) => {
      if (!smaPeriods.has(period)) { chart.removeSeries(series); this.smaSeries.delete(period); }
    });
    if (this.bbSeries && !hasBb) {
      chart.removeSeries(this.bbSeries.upper);
      chart.removeSeries(this.bbSeries.middle);
      chart.removeSeries(this.bbSeries.lower);
      this.bbSeries = undefined;
    }
    if (this.rsiSeries && !hasRsi) { chart.removeSeries(this.rsiSeries); this.rsiSeries = undefined; }
    if (this.atrSeries && !hasAtr) { chart.removeSeries(this.atrSeries); this.atrSeries = undefined; }
    if (this.macdHistogramSeries && !hasMacd) { chart.removeSeries(this.macdHistogramSeries); this.macdHistogramSeries = undefined; }

    // create series only if not yet present, then always update data
    const emaColors: string[] = ['#FFD700', '#FF8C00', '#FF4500', '#FF1493'];
    Array.from(emaPeriods).sort((a, b) => a - b).forEach((period: number, i: number) => {
      if (!this.emaSeries.has(period)) {
        const series: ISeriesApi<'Line'> = chart.addSeries(LineSeries, {
          priceScaleId: 'right', color: emaColors[i % emaColors.length], lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
        });
        this.emaSeries.set(period, series);
      }
      const data: LineData[] = bars
        .filter(k => k.indicators?.ema?.[period] !== undefined)
        .map(k => ({ time: k.times.open / 1000 as Time, value: k.indicators!.ema![period] }));
      this.emaSeries.get(period)!.setData(data);
    });

    const smaColors: string[] = ['#00BFFF', '#00FA9A', '#7B68EE', '#20B2AA'];
    Array.from(smaPeriods).sort((a, b) => a - b).forEach((period: number, i: number) => {
      if (!this.smaSeries.has(period)) {
        const series: ISeriesApi<'Line'> = chart.addSeries(LineSeries, {
          priceScaleId: 'right', color: smaColors[i % smaColors.length], lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
        });
        this.smaSeries.set(period, series);
      }
      const data: LineData[] = bars
        .filter(k => k.indicators?.sma?.[period] !== undefined)
        .map(k => ({ time: k.times.open / 1000 as Time, value: k.indicators!.sma![period] }));
      this.smaSeries.get(period)!.setData(data);
    });

    if (hasBb && !this.bbSeries) {
      const upperSeries: ISeriesApi<'Line'> = chart.addSeries(LineSeries, {
        priceScaleId: 'right', color: 'rgba(255, 100, 100, 0.7)', lineWidth: 1,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
      });
      const middleSeries: ISeriesApi<'Line'> = chart.addSeries(LineSeries, {
        priceScaleId: 'right', color: 'rgba(200, 200, 200, 0.5)', lineWidth: 1,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
      });
      const lowerSeries: ISeriesApi<'Line'> = chart.addSeries(LineSeries, {
        priceScaleId: 'right', color: 'rgba(100, 200, 100, 0.7)', lineWidth: 1,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
      });
      this.bbSeries = { upper: upperSeries, middle: middleSeries, lower: lowerSeries };
    }
    if (hasBb && this.bbSeries) {
      const upperData: LineData[] = [];
      const middleData: LineData[] = [];
      const lowerData: LineData[] = [];
      bars.forEach((bar: Bar) => {
        if (!bar.indicators?.bb) return;
        const time: Time = bar.times.open / 1000 as Time;
        upperData.push({ time, value: bar.indicators.bb.upper });
        middleData.push({ time, value: bar.indicators.bb.middle });
        lowerData.push({ time, value: bar.indicators.bb.lower });
      });
      this.bbSeries.upper.setData(upperData);
      this.bbSeries.middle.setData(middleData);
      this.bbSeries.lower.setData(lowerData);
    }

    if (hasRsi && !this.rsiSeries) {
      this.rsiSeries = chart.addSeries(LineSeries, {
        priceScaleId: 'rsi', color: 'rgba(155, 89, 182, 0.4)', lineWidth: 1,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        // skip the O(n) visible-range data scan — return fixed range immediately
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } })
      });
      chart.priceScale('rsi').applyOptions({ visible: false, scaleMargins: { top: 0, bottom: 0 } });
    }
    if (hasRsi) {
      this.rsiBars = bars.filter(k => k.indicators?.rsi !== undefined);
      this.setRsiData(bars.length);
    }

    if (hasAtr && !this.atrSeries) {
      this.atrSeries = chart.addSeries(LineSeries, {
        priceScaleId: 'atr', color: '#1ABC9C', lineWidth: 1,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
      });
      chart.priceScale('atr').applyOptions({ visible: false });
    }
    if (hasAtr && this.atrSeries) {
      const data: LineData[] = bars
        .filter(k => k.indicators?.atr !== undefined)
        .map(k => ({ time: k.times.open / 1000 as Time, value: k.indicators!.atr! }));
      this.atrSeries.setData(data);
    }

    if (hasMacd && !this.macdHistogramSeries) {
      this.macdHistogramSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: 'macd', priceLineVisible: false, lastValueVisible: false
      });
      chart.priceScale('macd').applyOptions({ visible: false });
    }
    if (hasMacd && this.macdHistogramSeries) {
      this.setMacdData(bars, macdAlpha);
    }
  }

  public getRsiSeries(): ISeriesApi<'Line'> | undefined {
    return this.rsiSeries;
  }

  public setRsiHover(hovered: boolean): void {
    if (!this.rsiSeries || this.rsiHovered === hovered) return;
    this.rsiHovered = hovered;
    this.rsiSeries.applyOptions(
      hovered
        ? { color: 'rgba(155, 89, 182, 1.0)', lineWidth: 2 }
        : { color: 'rgba(155, 89, 182, 0.4)', lineWidth: 1 }
    );
  }

  public setRsiData(numVisibleBars: number): void {
    if (!this.rsiSeries || !this.rsiBars.length) return;
    // Downsample: keep at most 500 points so the renderer doesn't process every noisy tick
    const step: number = Math.max(1, Math.floor(numVisibleBars / 500));
    const data: LineData[] = [];
    for (let i = 0; i < this.rsiBars.length; i += step) {
      const k: Bar = this.rsiBars[i];
      data.push({ time: k.times.open / 1000 as Time, value: k.indicators!.rsi! });
    }
    this.rsiSeries.setData(data);
  }

  public setMacdData(bars: Bar[], alpha: number): void {
    if (!this.macdHistogramSeries) return;
    const data: HistogramData[] = bars
      .filter(k => k.indicators?.macd !== undefined)
      .map(k => ({
        time: k.times.open / 1000 as Time,
        value: k.indicators!.macd!.histogram,
        color: k.indicators!.macd!.histogram >= 0 ? `rgba(100, 180, 255, ${alpha})` : `rgba(255, 160, 50, ${alpha})`
      }));
    this.macdHistogramSeries.setData(data);
  }

  public setVisible(visible: boolean): void {
    const applyVisible = (series: ISeriesApi<'Line'> | ISeriesApi<'Histogram'>) =>
      series.applyOptions({ visible });

    this.emaSeries.forEach(applyVisible);
    this.smaSeries.forEach(applyVisible);
    if (this.bbSeries) {
      applyVisible(this.bbSeries.upper);
      applyVisible(this.bbSeries.middle);
      applyVisible(this.bbSeries.lower);
    }
    if (this.rsiSeries) applyVisible(this.rsiSeries);
    if (this.atrSeries) applyVisible(this.atrSeries);
    if (this.macdHistogramSeries) applyVisible(this.macdHistogramSeries);
  }

  public getLegendValues(param: MouseEventParams<Time>): { label: string; value: string }[] {
    const values: { label: string; value: string }[] = [];

    this.emaSeries.forEach((series, period) => {
      const d = param.seriesData.get(series) as LineData;
      if (d) values.push({ label: `EMA${period}`, value: d.value.toFixed(2) });
    });
    this.smaSeries.forEach((series, period) => {
      const d = param.seriesData.get(series) as LineData;
      if (d) values.push({ label: `SMA${period}`, value: d.value.toFixed(2) });
    });
    if (this.bbSeries) {
      const upper = param.seriesData.get(this.bbSeries.upper) as LineData;
      const middle = param.seriesData.get(this.bbSeries.middle) as LineData;
      const lower = param.seriesData.get(this.bbSeries.lower) as LineData;
      if (upper && middle && lower) {
        values.push({ label: 'BB', value: `${upper.value.toFixed(2)} / ${middle.value.toFixed(2)} / ${lower.value.toFixed(2)}` });
      }
    }
    if (this.rsiSeries && this.rsiBars.length && param.time !== undefined) {
      const hoveredTime = param.time as number;
      const bar = this.rsiBars.find(k => k.times.open / 1000 === hoveredTime);
      if (bar) values.push({ label: 'RSI', value: bar.indicators!.rsi!.toFixed(2) });
    }
    if (this.atrSeries) {
      const d = param.seriesData.get(this.atrSeries) as LineData;
      if (d) values.push({ label: 'ATR', value: d.value.toFixed(2) });
    }
    if (this.macdHistogramSeries) {
      const d = param.seriesData.get(this.macdHistogramSeries) as HistogramData;
      if (d) values.push({ label: 'MACD', value: d.value.toFixed(4) });
    }

    return values;
  }
}
