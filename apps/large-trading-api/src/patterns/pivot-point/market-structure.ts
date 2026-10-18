import {
  Bar,
  Direction,
  MarketStructurePivot,
  MarketStructureProtectiveLevel,
  MarketStructureState,
  MarketStructureType,
  PivotPoint,
  PivotPointSide,
} from '@shared';
import PivotPointController from './pivot-point';

export default class MarketStructureController extends PivotPointController {
  public stepMarketStructure(bars: Bar[], state: MarketStructureState, space: number): void {
    const pivotIndex: number = bars.length - 2 - space;

    if (pivotIndex >= 0 && pivotIndex !== state.lastProcessedIndex) {
      state.lastProcessedIndex = pivotIndex;
      const pivotPoint: PivotPoint | null = this.getPivotPoint(bars, pivotIndex, space);
      if (pivotPoint) this.updateSwings(bars, state, { bar: bars[pivotIndex], index: pivotIndex, pivotPoint });
    }

    this.updateProtectiveLevel(bars, bars.length - 1, state);
    this.setMarketStructureStats(bars[bars.length - 1], state);
  }

  private updateSwings(bars: Bar[], state: MarketStructureState, pivot: MarketStructurePivot): void {
    if (state.swingCandidate && pivot.pivotPoint.side !== state.swingCandidate.pivotPoint.side) {
      this.confirmSwing(bars, state, state.swingCandidate);
      state.swingCandidate = pivot;
    } else if (!state.swingCandidate || this.isMoreExtreme(pivot, state.swingCandidate)) {
      state.swingCandidate = pivot;
    }
  }

  private confirmSwing(bars: Bar[], state: MarketStructureState, swing: MarketStructurePivot): void {
    const isHigh: boolean = swing.pivotPoint.side === PivotPointSide.High;
    const previousSameSideSwing: MarketStructurePivot | undefined = isHigh ? state.lastSwingHigh : state.lastSwingLow;

    swing.bar.chart = swing.bar.chart || {};
    swing.bar.chart.pivotPoint = swing.pivotPoint;

    if (isHigh) {
      state.lastSwingHigh = swing;
    } else {
      state.lastSwingLow = swing;
    }

    if (previousSameSideSwing) {
      swing.pivotPoint.marketStructure = this.getMarketStructureType(swing, previousSameSideSwing);
      this.updateTrend(bars, state, swing);
    }
  }

  private getMarketStructureType(swing: MarketStructurePivot, previousSameSideSwing: MarketStructurePivot): MarketStructureType {
    if (swing.pivotPoint.side === PivotPointSide.High) {
      return swing.bar.prices.high > previousSameSideSwing.bar.prices.high ? MarketStructureType.HH : MarketStructureType.LH;
    } else {
      return swing.bar.prices.low > previousSameSideSwing.bar.prices.low ? MarketStructureType.HL : MarketStructureType.LL;
    }
  }

  private updateTrend(bars: Bar[], state: MarketStructureState, swing: MarketStructurePivot): void {
    const direction: Direction = [MarketStructureType.HH, MarketStructureType.HL].includes(swing.pivotPoint.marketStructure!)
      ? Direction.Up
      : Direction.Down;
    state.streak = direction === state.direction ? state.streak! + 1 : 1;
    state.direction = direction;
    state.protectiveLevel = this.getConfirmedLevel(state);
    state.isReversed = false;

    for (let index = swing.index + 1; index < bars.length - 1; index++) this.updateProtectiveLevel(bars, index, state);
  }

  private updateProtectiveLevel(bars: Bar[], index: number, state: MarketStructureState): void {
    if (!state.protectiveLevel) return;

    const continuationSwing: MarketStructurePivot | undefined = this.getContinuationSwing(state, state.protectiveLevel);

    if (state.protectiveLevel.protectedDirection === Direction.Up) {
      if (bars[index].prices.low < state.protectiveLevel.price) {
        state.protectiveLevel = this.getHighestLevel(bars, state.protectiveLevel.index, index);
        state.isReversed = true;
      } else if (continuationSwing && bars[index].prices.high > continuationSwing.bar.prices.high) {
        state.protectiveLevel = this.getLowestLevel(bars, continuationSwing.index, index);
      }
    } else {
      if (bars[index].prices.high > state.protectiveLevel.price) {
        state.protectiveLevel = this.getLowestLevel(bars, state.protectiveLevel.index, index);
        state.isReversed = true;
      } else if (continuationSwing && bars[index].prices.low < continuationSwing.bar.prices.low) {
        state.protectiveLevel = this.getHighestLevel(bars, continuationSwing.index, index);
      }
    }
  }

  private getContinuationSwing(
    state: MarketStructureState,
    protectiveLevel: MarketStructureProtectiveLevel,
  ): MarketStructurePivot | undefined {
    const side: PivotPointSide = protectiveLevel.protectedDirection === Direction.Up ? PivotPointSide.High : PivotPointSide.Low;
    const confirmedSwing: MarketStructurePivot | undefined = side === PivotPointSide.High ? state.lastSwingHigh : state.lastSwingLow;
    const latestSwing: MarketStructurePivot | undefined =
      state.swingCandidate?.pivotPoint.side === side ? state.swingCandidate : confirmedSwing;
    return latestSwing && latestSwing.index > protectiveLevel.index ? latestSwing : undefined;
  }

  private getConfirmedLevel(state: MarketStructureState): MarketStructureProtectiveLevel | undefined {
    if (state.direction === Direction.Up && state.lastSwingLow?.pivotPoint.marketStructure) {
      return { protectedDirection: Direction.Up, index: state.lastSwingLow.index, price: state.lastSwingLow.bar.prices.low };
    }

    if (state.direction === Direction.Down && state.lastSwingHigh?.pivotPoint.marketStructure) {
      return { protectedDirection: Direction.Down, index: state.lastSwingHigh.index, price: state.lastSwingHigh.bar.prices.high };
    }

    return undefined;
  }

  private getHighestLevel(bars: Bar[], startIndex: number, endIndex: number): MarketStructureProtectiveLevel {
    let highestIndex: number = startIndex;

    for (let index = startIndex + 1; index <= endIndex; index++) {
      if (bars[index].prices.high > bars[highestIndex].prices.high) highestIndex = index;
    }

    return { protectedDirection: Direction.Down, index: highestIndex, price: bars[highestIndex].prices.high };
  }

  private getLowestLevel(bars: Bar[], startIndex: number, endIndex: number): MarketStructureProtectiveLevel {
    let lowestIndex: number = startIndex;

    for (let index = startIndex + 1; index <= endIndex; index++) {
      if (bars[index].prices.low < bars[lowestIndex].prices.low) lowestIndex = index;
    }

    return { protectedDirection: Direction.Up, index: lowestIndex, price: bars[lowestIndex].prices.low };
  }

  private setMarketStructureStats(bar: Bar, state: MarketStructureState): void {
    if (!state.direction) return;

    bar.chart = bar.chart || {};
    bar.chart.marketStructure = state.isReversed
      ? { streak: 1, direction: state.protectiveLevel!.protectedDirection }
      : { streak: state.streak!, direction: state.direction };
  }

  private isMoreExtreme(pivot: MarketStructurePivot, swingCandidate: MarketStructurePivot): boolean {
    return pivot.pivotPoint.side === PivotPointSide.High
      ? pivot.bar.prices.high > swingCandidate.bar.prices.high
      : pivot.bar.prices.low < swingCandidate.bar.prices.low;
  }
}
