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

export interface CompactSignalMarker {
  time: number;
  price: number;
  side: 'above' | 'below';
  color: string;
}

interface RenderedCompactSignal {
  x: number;
  y: number;
  side: 'above' | 'below';
  color: string;
}

class CompactSignalsPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _items: RenderedCompactSignal[]) { }

  draw(target: any): void {
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio }: any) => {
      const pixelRatio = Math.min(horizontalPixelRatio, verticalPixelRatio);
      const radius = 2 * pixelRatio;
      const offset = 5 * pixelRatio;

      for (const item of this._items) {
        const x = item.x * horizontalPixelRatio;
        const baseY = item.y * verticalPixelRatio;
        const y = item.side === 'above' ? baseY - offset : baseY + offset;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }
}

class CompactSignalsPaneView implements IPrimitivePaneView {
  private _renderer = new CompactSignalsPaneRenderer([]);

  update(items: RenderedCompactSignal[]): void {
    this._renderer = new CompactSignalsPaneRenderer(items);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

export class CompactSignalsPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneView = new CompactSignalsPaneView();
  private _markers: CompactSignalMarker[] = [];

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  setMarkers(markers: CompactSignalMarker[]): void {
    this._markers = markers;
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    if (!this._chart || !this._series) return;

    const timeScale = this._chart.timeScale();
    const items: RenderedCompactSignal[] = [];

    for (const marker of this._markers) {
      const x = timeScale.timeToCoordinate(marker.time as Time);
      const y = this._series.priceToCoordinate(marker.price);

      if (x === null || y === null) continue;

      items.push({ x, y, side: marker.side, color: marker.color });
    }

    this._paneView.update(items);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}
