import Base from '../../../base';
import { Direction, Kline, KlineWithIndex, MarketStructureType, PivotPoint, PivotPointSide } from '@shared';

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

      this.addStreak(kline, i, klinesWithPivotPoints, klines, space);
    });
  }

  private isMarketStructurePivotPoint(klines: Kline[], index: number, space: number, lastPivotPointSide: PivotPointSide | null): boolean {
    const currentKline: Kline = klines[index];
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
    const currentPrice: number = currentSide === PivotPointSide.High
      ? klines[currentIndex].prices.high
      : klines[currentIndex].prices.low;

    for (let i = currentIndex + 1; i < klines.length; i++) {
      const nextPivotPoint: PivotPoint | null = this.getPivotPoint(klines, i, space);

      if (nextPivotPoint) {
        if (nextPivotPoint.side !== currentSide) return true;

        const nextPrice: number = nextPivotPoint.side === PivotPointSide.High
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

  private addStreak(currentKline: Kline, currentIndex: number, klinesWithPivotPoints: KlineWithIndex[], klines: Kline[], space: number): void {
    // remove first 2 since they have no market structure, just PP
    // remove klines that look past currentIndex into the future because of space to the right (cheating)
    const klinesWithMarketStructure: KlineWithIndex[] = klinesWithPivotPoints.slice(2).filter((kline: KlineWithIndex) => {
      return kline.index < currentIndex - space;
    });

    if (klinesWithMarketStructure.length < 2) return;

    let streak: number = 0;
    let direction: Direction | undefined;

    for (let i = klinesWithMarketStructure.length - 1; i >= 0; i--) {
      const currentKline: KlineWithIndex = klinesWithMarketStructure[i];
      const marketStructure: MarketStructureType = currentKline.kline.chart!.pivotPoint!.marketStructure!;
      const currentDirection: Direction = [MarketStructureType.HH, MarketStructureType.HL].includes(marketStructure) ? Direction.Up : Direction.Down;

      if (!direction) {
        direction = currentDirection;
        streak++;
      } else {
        if (currentDirection === direction) {
          streak++;
        } else {
          break;
        }
      }
    }

    const isReversal: boolean = this.isDirectionReversalSinceLastMarketStructure(klinesWithMarketStructure, klines, currentIndex, direction!);

    if (isReversal) {
      direction = direction === Direction.Up ? Direction.Down : Direction.Up;
      streak = 1;
    }

    currentKline.chart = currentKline.chart || {};
    currentKline.chart!.marketStructure = { streak, direction: direction! };
  }

  // e.g. last HL was at 10, now price dips below 10 meaning we can already say we have a LL even though we don't know the exact pivot point
  private isDirectionReversalSinceLastMarketStructure(klinesWithMarketStructure: KlineWithIndex[], klines: Kline[], currentIndex: number, direction: Direction): boolean {
    const relevantSide: PivotPointSide = direction === Direction.Up ? PivotPointSide.Low : PivotPointSide.High;

    const lastRelevantKline: KlineWithIndex = [...klinesWithMarketStructure].reverse().find(
      k => k.kline.chart!.pivotPoint!.side === relevantSide
    )!;

    const pricesSince: Kline[] = klines.slice(klinesWithMarketStructure.at(-1)!.index + 1, currentIndex + 1);

    if (direction === Direction.Up) {
      const lastLow: number = lastRelevantKline.kline.prices.low;
      return pricesSince.some(k => k.prices.low < lastLow);
    } else {
      const lastHigh: number = lastRelevantKline.kline.prices.high;
      return pricesSince.some(k => k.prices.high > lastHigh);
    }
  }

  private getPivotPoint(klines: Kline[], i: number, space: number, side?: PivotPointSide): PivotPoint | null {
    if (!klines[i - space] || !klines[i + space]) return null;

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