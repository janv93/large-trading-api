import { Bar, Direction, MarketStructurePivot, MarketStructureState, MarketStructureType, PivotPoint, PivotPointSide } from '@shared';
import PivotPointController from './pivot-point';

export default class MarketStructureController extends PivotPointController {
  public stepMarketStructure(bars: Bar[], state: MarketStructureState, space: number): void {
    const pivotIndex: number = bars.length - 2 - space;

    if (pivotIndex >= 0 && pivotIndex !== state.lastProcessedIndex) {
      state.lastProcessedIndex = pivotIndex;
      const pivotPoint: PivotPoint | null = this.getPivotPoint(bars, pivotIndex, space);
      if (pivotPoint) this.updateSwings(bars, state, { bar: bars[pivotIndex], index: pivotIndex, pivotPoint });
      this.updateReversal(bars[bars.length - 2], state);
    }

    this.updateReversal(bars[bars.length - 1], state);
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
    state.isReversed = false;

    for (let index = swing.index + 1; index < bars.length - 2; index++) this.updateReversal(bars[index], state);
  }

  private updateReversal(bar: Bar, state: MarketStructureState): void {
    if (state.isReversed) return;

    if (state.direction === Direction.Up && state.lastSwingLow?.pivotPoint.marketStructure) {
      state.isReversed = bar.prices.low < state.lastSwingLow.bar.prices.low;
    } else if (state.direction === Direction.Down && state.lastSwingHigh?.pivotPoint.marketStructure) {
      state.isReversed = bar.prices.high > state.lastSwingHigh.bar.prices.high;
    }
  }

  private setMarketStructureStats(bar: Bar, state: MarketStructureState): void {
    if (!state.direction) return;

    const reversedDirection: Direction = state.direction === Direction.Up ? Direction.Down : Direction.Up;
    bar.chart = bar.chart || {};
    bar.chart.marketStructure = state.isReversed
      ? { streak: 1, direction: reversedDirection }
      : { streak: state.streak!, direction: state.direction };
  }

  private isMoreExtreme(pivot: MarketStructurePivot, swingCandidate: MarketStructurePivot): boolean {
    return pivot.pivotPoint.side === PivotPointSide.High
      ? pivot.bar.prices.high > swingCandidate.bar.prices.high
      : pivot.bar.prices.low < swingCandidate.bar.prices.low;
  }
}
