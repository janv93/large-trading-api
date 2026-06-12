import { Direction, Bar, BarWithIndex, MarketStructureType, PivotPoint, PivotPointSide } from '@shared';
import Base from '../../../base';

export default class PivotPointController extends Base {
  // add pivot points defined by horizontally uninterrupted highs/lows on the left and right side
  public addPivotPoints(bars: Bar[], space: number): void {
    bars.forEach((bar: Bar, i: number) => {
      const pivotPoint: PivotPoint | null = this.getPivotPoint(bars, i, space);

      if (pivotPoint) {
        bar.chart = bar.chart || {};
        bar.chart.pivotPoint = pivotPoint;
      }
    });
  }

  public addMarketStructure(bars: Bar[], space: number): void {
    const barsWithPivotPoints: BarWithIndex[] = [];

    bars.forEach((bar: Bar, i: number) => {
      const lastPivotPointSide: PivotPointSide | null = barsWithPivotPoints.at(-1)?.bar.chart!.pivotPoint!.side || null;
      const isPivotPoint: boolean = this.isMarketStructurePivotPoint(bars, i, space, lastPivotPointSide);

      if (isPivotPoint) {
        barsWithPivotPoints.push({ bar, index: i });
        this.addMarketStructureFromPivotPoints(barsWithPivotPoints);
      }

      this.addStreak(bar, i, barsWithPivotPoints, bars, space);
    });
  }

  private isMarketStructurePivotPoint(bars: Bar[], index: number, space: number, lastPivotPointSide: PivotPointSide | null): boolean {
    const currentBar: Bar = bars[index];
    const oppositeSide: PivotPointSide = lastPivotPointSide === PivotPointSide.High ? PivotPointSide.Low : PivotPointSide.High;
    const pivotPoint: PivotPoint | null = this.getPivotPoint(bars, index, space, oppositeSide);

    if (pivotPoint && this.nextPivotPointIsOppositeOrMinor(bars, index, pivotPoint.side, space)) {
      currentBar.chart = currentBar.chart || {};
      currentBar.chart.pivotPoint = pivotPoint;
      return true;
    } else {
      return false;
    }
  }

  private nextPivotPointIsOppositeOrMinor(bars: Bar[], currentIndex: number, currentSide: PivotPointSide, space: number): boolean {
    const currentPrice: number = currentSide === PivotPointSide.High
      ? bars[currentIndex].prices.high
      : bars[currentIndex].prices.low;

    for (let i = currentIndex + 1; i < bars.length; i++) {
      const nextPivotPoint: PivotPoint | null = this.getPivotPoint(bars, i, space);

      if (nextPivotPoint) {
        if (nextPivotPoint.side !== currentSide) return true;

        const nextPrice: number = nextPivotPoint.side === PivotPointSide.High
          ? bars[i].prices.high
          : bars[i].prices.low;

        return currentSide === PivotPointSide.High ? nextPrice < currentPrice : nextPrice > currentPrice;
      }
    }

    return true;
  }

  private addMarketStructureFromPivotPoints(barsWithPivotPoints: BarWithIndex[]): void {
    if (barsWithPivotPoints.length < 3) return;

    const currentBar: BarWithIndex = barsWithPivotPoints.at(-1)!;
    const currentSide: PivotPointSide = currentBar.bar.chart!.pivotPoint!.side;

    const previousSameSide: BarWithIndex = [...barsWithPivotPoints].slice(0, -1).reverse().find(
      (k: BarWithIndex) => k.bar.chart!.pivotPoint!.side === currentSide
    )!;

    const currentPrice: number = currentSide === PivotPointSide.High
      ? currentBar.bar.prices.high
      : currentBar.bar.prices.low;

    const previousPrice: number = currentSide === PivotPointSide.High
      ? previousSameSide.bar.prices.high
      : previousSameSide.bar.prices.low;

    let type: MarketStructureType;

    if (currentSide === PivotPointSide.High) {
      type = currentPrice > previousPrice ? MarketStructureType.HH : MarketStructureType.LH;
    } else {
      type = currentPrice > previousPrice ? MarketStructureType.HL : MarketStructureType.LL;
    }

    currentBar.bar.chart!.pivotPoint!.marketStructure = type;
  }

  private addStreak(currentBar: Bar, currentIndex: number, barsWithPivotPoints: BarWithIndex[], bars: Bar[], space: number): void {
    // remove first 2 since they have no market structure, just PP
    // remove bars that look past currentIndex into the future because of space to the right (cheating)
    const barsWithMarketStructure: BarWithIndex[] = barsWithPivotPoints.slice(2).filter((bar: BarWithIndex) => {
      return bar.index < currentIndex - space;
    });

    if (barsWithMarketStructure.length < 2) return;

    let streak: number = 0;
    let direction: Direction | undefined;

    for (let i = barsWithMarketStructure.length - 1; i >= 0; i--) {
      const currentBar: BarWithIndex = barsWithMarketStructure[i];
      const marketStructure: MarketStructureType = currentBar.bar.chart!.pivotPoint!.marketStructure!;
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

    const isReversal: boolean = this.isDirectionReversalSinceLastMarketStructure(barsWithMarketStructure, bars, currentIndex, direction!);

    if (isReversal) {
      direction = direction === Direction.Up ? Direction.Down : Direction.Up;
      streak = 1;
    }

    currentBar.chart = currentBar.chart || {};
    currentBar.chart!.marketStructure = { streak, direction: direction! };
  }

  // e.g. last HL was at 10, now price dips below 10 meaning we can already say we have a LL even though we don't know the exact pivot point
  private isDirectionReversalSinceLastMarketStructure(barsWithMarketStructure: BarWithIndex[], bars: Bar[], currentIndex: number, direction: Direction): boolean {
    const relevantSide: PivotPointSide = direction === Direction.Up ? PivotPointSide.Low : PivotPointSide.High;

    const lastRelevantBar: BarWithIndex = [...barsWithMarketStructure].reverse().find(
      k => k.bar.chart!.pivotPoint!.side === relevantSide
    )!;

    const pricesSince: Bar[] = bars.slice(barsWithMarketStructure.at(-1)!.index + 1, currentIndex + 1);

    if (direction === Direction.Up) {
      const lastLow: number = lastRelevantBar.bar.prices.low;
      return pricesSince.some(k => k.prices.low < lastLow);
    } else {
      const lastHigh: number = lastRelevantBar.bar.prices.high;
      return pricesSince.some(k => k.prices.high > lastHigh);
    }
  }

  private getPivotPoint(bars: Bar[], i: number, space: number, side?: PivotPointSide): PivotPoint | null {
    if (!bars[i - space] || !bars[i + space]) return null;

    const bar: Bar = bars[i];
    const currentHigh: number = bar.prices.high;
    const currentLow: number = bar.prices.low;
    const isLeftHigh: boolean = bars.slice(i - space + 1, i).every(k => k.prices.high <= currentHigh);
    const isRightHigh: boolean = bars.slice(i + 1, i + space).every(k => k.prices.high <= currentHigh);
    const isLeftLow: boolean = bars.slice(i - space + 1, i).every(k => k.prices.low >= currentLow);
    const isRightLow: boolean = bars.slice(i + 1, i + space).every(k => k.prices.low >= currentLow);
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