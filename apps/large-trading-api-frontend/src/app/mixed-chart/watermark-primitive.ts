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

class WatermarkPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _symbol: string,
    private readonly _image: HTMLImageElement | null,
    private readonly _isMulti: boolean
  ) { }

  draw(target: any): void {
    target.useBitmapCoordinateSpace(({ context: ctx, bitmapSize }: any) => {
      const cx = bitmapSize.width / 2;
      const cy = bitmapSize.height / 6;
      const fontSize = this._isMulti ? 110 : 200;

      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'white';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      if (this._image && !this._isMulti) {
        const imgSize = fontSize * 0.8;
        const gap = fontSize * 0.2;
        const metrics = ctx.measureText(this._symbol);
        const textVisualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        const textWidth = metrics.width;
        const totalWidth = imgSize + gap + textWidth;
        // alphabetic baseline position so the text's visual center aligns with cy
        const textY = cy + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
        const imgX = cx - totalWidth / 2;
        const imgY = cy - textVisualHeight / 2;
        ctx.drawImage(this._image, imgX, imgY, imgSize, imgSize);
        ctx.fillText(this._symbol, imgX + imgSize + gap, textY);
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this._symbol, cx, cy);
      }

      ctx.restore();
    });
  }
}

class WatermarkPaneView implements IPrimitivePaneView {
  private _renderer = new WatermarkPaneRenderer('', null, false);

  update(symbol: string, image: HTMLImageElement | null, isMulti: boolean): void {
    this._renderer = new WatermarkPaneRenderer(symbol, image, isMulti);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

export class WatermarkPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneView = new WatermarkPaneView();
  private _image: HTMLImageElement | null = null;
  private _symbol = '';
  private _isMulti = false;

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

  setConfig(symbol: string, exchange: string, isMulti: boolean): void {
    this._symbol = symbol;
    this._isMulti = isMulti;

    if (!isMulti) {
      const img = new Image();
      img.onload = () => {
        this._image = img;
        this._paneView.update(this._symbol, this._image, this._isMulti);
        this._requestUpdate?.();
      };
      img.src = `assets/images/${exchange.toLowerCase()}.png`;
    } else {
      this._image = null;
    }

    this._paneView.update(this._symbol, this._image, this._isMulti);
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    this._paneView.update(this._symbol, this._image, this._isMulti);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}
