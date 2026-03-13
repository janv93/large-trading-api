import {
  ISeriesPrimitive,
  ISeriesApi,
  IChartApiBase,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  SeriesType,
  Time
} from 'lightweight-charts';
import { LinearFunction } from '../linear-function';

export interface TrendLineSegment {
  startTime: number;
  startValue: number;
  endTime: number;
  endValue: number;
  startIndex: number;
  endIndex: number;
}

interface RenderedLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  highlighted: boolean;
}

class TrendLinesPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _lines: RenderedLine[]) { }

  draw(target: any): void {
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio }: any) => {
      for (const line of this._lines) {
        ctx.beginPath();
        ctx.strokeStyle = line.highlighted ? 'yellow' : '#2196f3';
        ctx.lineWidth = horizontalPixelRatio;
        ctx.moveTo(line.x1 * horizontalPixelRatio, line.y1 * verticalPixelRatio);
        ctx.lineTo(line.x2 * horizontalPixelRatio, line.y2 * verticalPixelRatio);
        ctx.stroke();
      }
    });
  }
}

class TrendLinesPaneView implements IPrimitivePaneView {
  private _renderer = new TrendLinesPaneRenderer([]);

  update(lines: RenderedLine[]): void {
    this._renderer = new TrendLinesPaneRenderer(lines);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

export class TrendLinesPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneView = new TrendLinesPaneView();
  private _segments: TrendLineSegment[] = [];
  private _hoverIndex: number | null = null;
  private _hoverPrice: number | null = null;

  /**
   * Lifecycle hook called automatically by lightweight-charts when attachPrimitive() is invoked.
   * Provides references needed by updateAllViews() to convert data to coordinates and request redraws.
   */
  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  /**
   * Lifecycle hook called automatically by lightweight-charts when detachPrimitive() is invoked.
   * Cleans up references to allow garbage collection.
   */
  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  setSegments(segments: TrendLineSegment[]): void {
    this._segments = segments;
    this._requestUpdate?.();
  }

  setHover(index: number | null, price: number | null): void {
    if (this._hoverIndex === index && this._hoverPrice === price) return;
    this._hoverIndex = index;
    this._hoverPrice = price;
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    if (!this._chart || !this._series) return;

    const timeScale = this._chart.timeScale();
    const visibleRange = timeScale.getVisibleRange();
    const lines: RenderedLine[] = [];

    for (const seg of this._segments) {
      if (visibleRange && (seg.endTime < (visibleRange.from as number) || seg.startTime > (visibleRange.to as number))) continue;

      const x1 = timeScale.timeToCoordinate(seg.startTime as Time);
      const y1 = this._series.priceToCoordinate(seg.startValue);
      const x2 = timeScale.timeToCoordinate(seg.endTime as Time);
      const y2 = this._series.priceToCoordinate(seg.endValue);

      if (x1 === null || y1 === null || x2 === null || y2 === null) continue;

      let highlighted = false;

      if (this._hoverIndex !== null && this._hoverPrice !== null) {
        const linearFunction = new LinearFunction(seg.startIndex, seg.startValue, seg.endIndex, seg.endValue);

        highlighted =
          linearFunction.isPointOnLine(this._hoverIndex, this._hoverPrice, 0.003) &&
          this._hoverIndex >= seg.startIndex &&
          this._hoverIndex <= seg.endIndex;
      }

      lines.push({ x1, y1, x2, y2, highlighted });
    }

    this._paneView.update(lines);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}
