import Base from '../../../base';
import { Kline, KlineWithIndex, MarketStructureType, PivotPoint, PivotPointSide } from '../../../interfaces';
import PivotPointController from './pivot-point';

export default class MarketStructureController extends Base {
  private pivotPointController = new PivotPointController();

  public addMarketStructure(klines: Kline[], length: number): void {
    const klinesWithPivotPoints: KlineWithIndex[] = [];

    klines.forEach((kline: Kline, i: number) => {
      const lastPivotPointSide: PivotPointSide | null = klinesWithPivotPoints.at(-1)?.kline.chart!.pivotPoint!.side || null;
      const isPivotPoint: boolean = this.isPivotPoint(klines, i, length, lastPivotPointSide);

      if (isPivotPoint) {
        klinesWithPivotPoints.push({ kline, index: i });
        this.addMarketStructureFromPivotPoints(klinesWithPivotPoints);
      }
    });
  }

  private isPivotPoint(klines: Kline[], index: number, length: number, lastPivotPointSide: PivotPointSide | null): boolean {
    const currentKline = klines[index];
    const oppositeSide: PivotPointSide = lastPivotPointSide === PivotPointSide.High ? PivotPointSide.Low : PivotPointSide.High;
    const pivotPoint: PivotPoint | null = this.pivotPointController.getPivotPoint(klines, index, length, length, oppositeSide);

    if (pivotPoint && this.nextPivotPointIsOppositeOrMinor(klines, index, pivotPoint.side, length)) {
      currentKline.chart = currentKline.chart || {};
      currentKline.chart.pivotPoint = pivotPoint;
      return true;
    } else {
      return false;
    }
  }

  private nextPivotPointIsOppositeOrMinor(klines: Kline[], currentIndex: number, currentSide: PivotPointSide, length: number): boolean {
    const currentPrice = currentSide === PivotPointSide.High
      ? klines[currentIndex].prices.high
      : klines[currentIndex].prices.low;

    for (let i = currentIndex + 1; i < klines.length; i++) {
      const nextPivotPoint: PivotPoint | null = this.pivotPointController.getPivotPoint(klines, i, length, length);

      if (nextPivotPoint) {
        if (nextPivotPoint.side !== currentSide) return true;

        const nextPrice = nextPivotPoint.side === PivotPointSide.High
          ? klines[i].prices.high
          : klines[i].prices.low;

        return currentSide === PivotPointSide.High ? nextPrice < currentPrice : nextPrice > currentPrice;
      }
    }

    return true;
  }

  private addMarketStructureFromPivotPoints(klinesWithPivotPoints: KlineWithIndex[]): void {
    if (klinesWithPivotPoints.length < 3) return;

    const currentKline: KlineWithIndex = klinesWithPivotPoints.at(-1)!;
    const currentSide: PivotPointSide = currentKline.kline.chart!.pivotPoint!.side;

    const previousSameSide: KlineWithIndex = [...klinesWithPivotPoints].slice(0, -1).reverse().find(
      (k: KlineWithIndex) => k.kline.chart!.pivotPoint!.side === currentSide
    )!;

    const currentPrice: number = currentSide === PivotPointSide.High
      ? currentKline.kline.prices.high
      : currentKline.kline.prices.low;

    const previousPrice: number = currentSide === PivotPointSide.High
      ? previousSameSide.kline.prices.high
      : previousSameSide.kline.prices.low;

    let type: MarketStructureType;

    if (currentSide === PivotPointSide.High) {
      type = currentPrice > previousPrice ? MarketStructureType.HH : MarketStructureType.LH;
    } else {
      type = currentPrice > previousPrice ? MarketStructureType.HL : MarketStructureType.LL;
    }

    currentKline.kline.chart!.marketStructure = {
      type,
      left: previousSameSide.index,
      right: currentKline.index
    };
  }
}