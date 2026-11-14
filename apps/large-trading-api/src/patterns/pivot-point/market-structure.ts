import {
  Bar,
  Direction,
  MarketStructureState,
  MarketStructureStats,
  MarketStructureSwing,
  MarketStructureType,
  PivotPoint,
  PivotPointSide,
} from '@shared';
import PivotPointController from './pivot-point';

export default class MarketStructureController extends PivotPointController {
  public stepMarketStructure(bars: Bar[], state: MarketStructureState, space: number): Direction | undefined {
    const closedIndex: number = bars.length - 2;
    if (closedIndex >= 0 && closedIndex !== state.lastClosedIndex) this.processClosedBar(bars, state, closedIndex, space);

    return this.getBreakDirection(bars.at(-1)!, state.reversalLevel);
  }

  private processClosedBar(bars: Bar[], state: MarketStructureState, closedIndex: number, space: number): void {
    state.lastClosedIndex = closedIndex;
    this.updateTrend(bars[closedIndex], state);

    const pivotIndex: number = closedIndex - space;
    const pivotPoint: PivotPoint | null = this.getPivotPoint(bars, pivotIndex, space);

    if (pivotPoint) {
      const pivot: MarketStructureSwing = {
        index: pivotIndex,
        price: this.getPrice(bars[pivotIndex], pivotPoint.side),
        side: pivotPoint.side,
      };
      this.updateSwings(bars, state, pivot, space);
    }

    this.drawTrend(bars[closedIndex], state.trend);
  }

  private updateSwings(bars: Bar[], state: MarketStructureState, pivot: MarketStructureSwing, space: number): void {
    if (state.candidateSwing && pivot.side !== state.candidateSwing.side) {
      this.confirmSwing(bars, state, state.candidateSwing, space);
      state.candidateSwing = pivot;
    } else if (!state.candidateSwing || this.isBeyondPrice(pivot.price, state.candidateSwing)) {
      state.candidateSwing = pivot;
    }
  }

  private confirmSwing(bars: Bar[], state: MarketStructureState, swing: MarketStructureSwing, space: number): void {
    const previousSwing: MarketStructureSwing | undefined = state.swings?.at(-1);
    const previousSameSideSwing: MarketStructureSwing | undefined = state.swings?.at(-2);

    if (previousSameSideSwing) {
      swing.trend = this.getSwingTrend(swing, previousSameSideSwing, previousSwing?.trend);
    }

    this.drawSwing(bars[swing.index], swing, space);
    state.swings = previousSwing ? [previousSwing, swing] : [swing];

    if (swing.trend) {
      state.trend = swing.trend;
      state.reversalLevel = this.getReversalLevel(state.swings, swing.trend.direction);

      for (let index = swing.index + 1; index <= state.lastClosedIndex!; index++) this.updateTrend(bars[index], state);
    }
  }

  private getSwingTrend(
    swing: MarketStructureSwing,
    previousSameSideSwing: MarketStructureSwing,
    previousTrend?: MarketStructureStats,
  ): MarketStructureStats {
    const direction: Direction = swing.price > previousSameSideSwing.price ? Direction.Up : Direction.Down;

    return {
      direction,
      streak: direction === previousTrend?.direction ? previousTrend.streak + 1 : 1,
    };
  }

  private getReversalLevel(swings: MarketStructureSwing[], direction: Direction): MarketStructureSwing | undefined {
    const reversalSide: PivotPointSide = direction === Direction.Up ? PivotPointSide.Low : PivotPointSide.High;
    const reversalSwing: MarketStructureSwing | undefined = swings.find((swing) => swing.side === reversalSide);

    if (reversalSwing?.trend) {
      return reversalSwing;
    }
  }

  private updateTrend(bar: Bar, state: MarketStructureState): void {
    const breakDirection: Direction | undefined = this.getBreakDirection(bar, state.reversalLevel);

    if (breakDirection) {
      state.trend = { direction: breakDirection, streak: 1 };
      state.reversalLevel = undefined;
    }
  }

  private getBreakDirection(bar: Bar, reversalLevel?: MarketStructureSwing): Direction | undefined {
    if (reversalLevel && this.isBeyondPrice(this.getPrice(bar, reversalLevel.side), reversalLevel)) {
      return reversalLevel.side === PivotPointSide.High ? Direction.Up : Direction.Down;
    }
  }

  private drawSwing(bar: Bar, swing: MarketStructureSwing, space: number): void {
    bar.chart ??= {};
    bar.chart.pivotPoint = { space, side: swing.side };

    if (swing.trend) {
      bar.chart.pivotPoint.marketStructure = this.getMarketStructureType(swing.side, swing.trend.direction);
    }
  }

  private getMarketStructureType(side: PivotPointSide, direction: Direction): MarketStructureType {
    if (side === PivotPointSide.High) {
      return direction === Direction.Up ? MarketStructureType.HH : MarketStructureType.LH;
    }

    return direction === Direction.Up ? MarketStructureType.HL : MarketStructureType.LL;
  }

  private drawTrend(bar: Bar, trend?: MarketStructureStats): void {
    if (trend) {
      bar.chart ??= {};
      bar.chart.marketStructure = { ...trend };
    }
  }

  private getPrice(bar: Bar, side: PivotPointSide): number {
    return side === PivotPointSide.High ? bar.prices.high : bar.prices.low;
  }

  private isBeyondPrice(price: number, swing: MarketStructureSwing): boolean {
    return swing.side === PivotPointSide.High ? price > swing.price : price < swing.price;
  }
}
