import { Direction, Bar, BarWithIndex, MarketStructureState, MarketStructureType, PivotPoint, PivotPointSide } from '@shared';
import Base from '../base';

export default class PivotPointController extends Base {
  public stepPivotPoints(bars: Bar[], space: number): void {
    const j: number = bars.length - 1 - space;
    if (j < 0) return;

    const pivotPoint: PivotPoint | null = this.getPivotPoint(bars, j, space);

    if (pivotPoint) {
      const bar: Bar = bars[j];
      bar.chart = bar.chart || {};
      bar.chart.pivotPoint = pivotPoint;
    }
  }

  public stepMarketStructure(bars: Bar[], state: MarketStructureState, space: number): void {
    state.barsWithPivotPoints ??= [];

    const j: number = bars.length - 1 - space;

    if (j >= 0) {
      const pivot: PivotPoint | null = this.getPivotPoint(bars, j, space);

      if (pivot) {
        const isFirstPivot: boolean = !state.candidate && !state.barsWithPivotPoints!.length;

        if (isFirstPivot) {
          state.candidate = { bar: bars[j], index: j, pivotPoint: pivot };
        } else if (pivot.side === state.candidate?.pivotPoint.side) {
          const isMoreExtreme: boolean = pivot.side === PivotPointSide.High
            ? bars[j].prices.high > state.candidate.bar.prices.high
            : bars[j].prices.low < state.candidate.bar.prices.low;
          if (isMoreExtreme) {
            state.candidate = { bar: bars[j], index: j, pivotPoint: pivot };
          }
        } else {
          const confirmedBar: Bar = state.candidate!.bar;
          confirmedBar.chart = confirmedBar.chart || {};
          confirmedBar.chart.pivotPoint = state.candidate!.pivotPoint;
          state.barsWithPivotPoints!.push({ bar: confirmedBar, index: state.candidate!.index });
          this.addMarketStructureFromPivotPoints(state.barsWithPivotPoints!);
          state.candidate = { bar: bars[j], index: j, pivotPoint: pivot };
        }
      }
    }

    const i: number = bars.length - 1;
    this.addStreak(bars[i], i, state.barsWithPivotPoints!, bars, space);
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

    if (!barsWithMarketStructure.length) return;

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

    const lastRelevantBar: BarWithIndex | undefined = [...barsWithMarketStructure].reverse().find(
      k => k.bar.chart!.pivotPoint!.side === relevantSide
    );

    if (!lastRelevantBar) return false;

    const pricesSince: Bar[] = bars.slice(barsWithMarketStructure.at(-1)!.index + 1, currentIndex + 1);

    if (direction === Direction.Up) {
      const lastLow: number = lastRelevantBar.bar.prices.low;
      return pricesSince.some(k => k.prices.low < lastLow);
    } else {
      const lastHigh: number = lastRelevantBar.bar.prices.high;
      return pricesSince.some(k => k.prices.high > lastHigh);
    }
  }

  private getPivotPoint(bars: Bar[], i: number, space: number): PivotPoint | null {
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

    if (pivotPointSide) {
      return { space, side: pivotPointSide };
    }

    return null;
  }
}