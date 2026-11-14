import { Bar, Direction, MarketStructureState, MarketStructureStats, MarketStructureType, PivotPoint, PivotPointSide } from '@shared';
import PivotPointController from './pivot-point';

export default class MarketStructureController extends PivotPointController {
  public stepMarketStructure(bars: Bar[], state: MarketStructureState, space: number): Direction | undefined {
    const closedIndex: number = bars.length - 2;
    if (closedIndex < 0) return;
    let reversal: Direction | undefined;

    if (state.lastClosedIndex !== closedIndex) {
      reversal = this.processClosedBar(bars, state, closedIndex, space);
      state.lastClosedIndex = closedIndex;
    }

    return reversal ?? this.getReversal(bars, state, bars.at(-1)!);
  }

  private processClosedBar(bars: Bar[], state: MarketStructureState, index: number, space: number): Direction | undefined {
    const reversal: Direction | undefined = this.getReversal(bars, state, bars[index]);

    if (reversal) {
      state.trend = { direction: reversal, streak: 1 };
      state.reversalIndex = index;
    }

    const previousTrend: MarketStructureStats | undefined = state.trend;
    this.processPivot(bars, state, index - space, space);
    const confirmedReversal: boolean = !!previousTrend && state.trend?.direction !== previousTrend.direction;
    const chartTrend: MarketStructureStats | undefined = confirmedReversal ? previousTrend : state.trend;

    if (chartTrend) {
      bars[index].chart ??= {};
      bars[index].chart.marketStructure = { ...chartTrend };
    }

    if (confirmedReversal) return state.trend!.direction;
  }

  private processPivot(bars: Bar[], state: MarketStructureState, index: number, space: number): void {
    const pivot: PivotPoint | null = this.getPivotPoint(bars, index, space);
    if (!pivot) return;
    const previousIndex: number | undefined = pivot.side === PivotPointSide.High ? state.highIndex : state.lowIndex;
    if (previousIndex === Math.max(state.highIndex ?? -1, state.lowIndex ?? -1)) return;

    if (pivot.side === PivotPointSide.High) state.highIndex = index;
    else state.lowIndex = index;

    bars[index].chart ??= {};
    bars[index].chart.pivotPoint = pivot;
    if (previousIndex === undefined) return;

    const difference: number = this.getPrice(bars[index], pivot.side) - this.getPrice(bars[previousIndex], pivot.side);

    if (difference === 0) {
      state.pivotTrend = undefined;

      if (state.trend && index >= (state.reversalIndex ?? -1)) {
        state.trend = { ...state.trend, streak: 0 };
      }

      return;
    }

    const direction: Direction = difference > 0 ? Direction.Up : Direction.Down;
    state.pivotTrend = { direction, streak: direction === state.pivotTrend?.direction ? state.pivotTrend.streak + 1 : 1 };

    if (index >= (state.reversalIndex ?? -1) && state.trend?.direction !== direction) {
      state.pivotTrend.streak = 1;
    }

    pivot.marketStructure = this.getLabel(pivot.side, direction);
    if (index >= (state.reversalIndex ?? -1)) state.trend = state.pivotTrend;
  }

  private getReversal(bars: Bar[], state: MarketStructureState, bar: Bar): Direction | undefined {
    if (!state.trend) return;

    if (state.trend.direction === Direction.Up) {
      if (state.lowIndex !== undefined && bar.prices.low < bars[state.lowIndex].prices.low) return Direction.Down;
    } else if (state.highIndex !== undefined && bar.prices.high > bars[state.highIndex].prices.high) {
      return Direction.Up;
    }
  }

  private getPrice(bar: Bar, side: PivotPointSide): number {
    return side === PivotPointSide.High ? bar.prices.high : bar.prices.low;
  }

  private getLabel(side: PivotPointSide, direction: Direction): MarketStructureType {
    if (side === PivotPointSide.High) return direction === Direction.Up ? MarketStructureType.HH : MarketStructureType.LH;
    return direction === Direction.Up ? MarketStructureType.HL : MarketStructureType.LL;
  }
}
