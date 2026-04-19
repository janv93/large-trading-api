import Base from '../../../base';
import { Kline, KlineWithIndex, MarketStructureType, PivotPoint, PivotPointSide } from '../../../interfaces';

export default class PivotPointController extends Base {
  // add pivot points defined by horizontally uninterrupted highs/lows on the left and right side
  public addPivotPoints(klines: Kline[], space: number): void {
    klines.forEach((kline: Kline, i: number) => {
      const pivotPoint: PivotPoint | null = this.getPivotPoint(klines, i, space);

      if (pivotPoint) {
        kline.chart = kline.chart || {};
        kline.chart.pivotPoint = pivotPoint;
      }
    });
  }

  public addMarketStructure(klines: Kline[], space: number): void {
    const klinesWithPivotPoints: KlineWithIndex[] = [];

    klines.forEach((kline: Kline, i: number) => {
      const lastPivotPointSide: PivotPointSide | null = klinesWithPivotPoints.at(-1)?.kline.chart!.pivotPoint!.side || null;
      const isPivotPoint: boolean = this.isMarketStructurePivotPoint(klines, i, space, lastPivotPointSide);

      if (isPivotPoint) {
        klinesWithPivotPoints.push({ kline, index: i });
        this.addMarketStructureFromPivotPoints(klinesWithPivotPoints);
      }
    });
  }

  private isMarketStructurePivotPoint(klines: Kline[], index: number, space: number, lastPivotPointSide: PivotPointSide | null): boolean {
    const currentKline = klines[index];
    const oppositeSide: PivotPointSide = lastPivotPointSide === PivotPointSide.High ? PivotPointSide.Low : PivotPointSide.High;
    const pivotPoint: PivotPoint | null = this.getPivotPoint(klines, index, space, oppositeSide);

    if (pivotPoint && this.nextPivotPointIsOppositeOrMinor(klines, index, pivotPoint.side, space)) {
      currentKline.chart = currentKline.chart || {};
      currentKline.chart.pivotPoint = pivotPoint;
      return true;
    } else {
      return false;
    }
  }

  private nextPivotPointIsOppositeOrMinor(klines: Kline[], currentIndex: number, currentSide: PivotPointSide, space: number): boolean {
    const currentPrice = currentSide === PivotPointSide.High
      ? klines[currentIndex].prices.high
      : klines[currentIndex].prices.low;

    for (let i = currentIndex + 1; i < klines.length; i++) {
      const nextPivotPoint: PivotPoint | null = this.getPivotPoint(klines, i, space);

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

    currentKline.kline.chart!.pivotPoint!.marketStructure = type;
  }

  private getPivotPoint(klines: Kline[], i: number, space: number, side?: PivotPointSide): PivotPoint | null {
    if (!klines[i - space] && klines[i + space]) return null;

    const kline: Kline = klines[i];
    const currentHigh: number = kline.prices.high;
    const currentLow: number = kline.prices.low;
    const isLeftHigh: boolean = klines.slice(i - space + 1, i).every(k => k.prices.high <= currentHigh);
    const isRightHigh: boolean = klines.slice(i + 1, i + space).every(k => k.prices.high <= currentHigh);
    const isLeftLow: boolean = klines.slice(i - space + 1, i).every(k => k.prices.low >= currentLow);
    const isRightLow: boolean = klines.slice(i + 1, i + space).every(k => k.prices.low >= currentLow);
    const isHigh: boolean = isLeftHigh && isRightHigh;
    const isLow: boolean = isLeftLow && isRightLow;
    const pivotPointSide: PivotPointSide | null = isHigh ? PivotPointSide.High : isLow ? PivotPointSide.Low : null;

    if (side && pivotPointSide !== side) return null;

    if (pivotPointSide) {
      return { space, side: pivotPointSide };
    }

    return null;
  }
}