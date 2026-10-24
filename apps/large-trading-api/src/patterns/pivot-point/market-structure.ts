import {
  Bar,
  Direction,
  MarketStructureLevel,
  MarketStructureState,
  MarketStructureStats,
  MarketStructureSwing,
  MarketStructureType,
  PivotPoint,
  PivotPointSide,
} from '@shared';
import PivotPointController from './pivot-point';

export default class MarketStructureController extends PivotPointController {
  public stepMarketStructure(bars: Bar[], state: MarketStructureState, space: number): void {
    this.updateObservedRange(bars, state);
    this.processClosedPivot(bars, state, space);
    this.updateTrend(bars, state, bars.length - 1);
    this.drawTrend(bars.at(-1)!, state.trend);
  }

  private updateObservedRange(bars: Bar[], state: MarketStructureState): void {
    const index: number = bars.length - 1;

    if (state.observedRange?.index === index) {
      state.observedRange.high = Math.max(state.observedRange.high, bars[index].prices.high);
      state.observedRange.low = Math.min(state.observedRange.low, bars[index].prices.low);
    } else {
      state.observedRange = { index, high: bars[index].prices.high, low: bars[index].prices.low };
    }
  }

  private processClosedPivot(bars: Bar[], state: MarketStructureState, space: number): void {
    const pivotIndex: number = bars.length - 2 - space;
    if (pivotIndex < 0 || pivotIndex === state.lastProcessedIndex) return;

    state.lastProcessedIndex = pivotIndex;
    const pivotPoint: PivotPoint | null = this.getPivotPoint(bars, pivotIndex, space);

    if (pivotPoint) {
      this.updateSwings(bars, state, {
        index: pivotIndex,
        price: this.getPrice(bars[pivotIndex], pivotPoint.side),
        side: pivotPoint.side,
        space: pivotPoint.space,
      });
    }
  }

  private updateSwings(bars: Bar[], state: MarketStructureState, pivot: MarketStructureSwing): void {
    state.swings ??= [];

    if (!state.swings.length) {
      state.swings.push(pivot);
    } else if (pivot.side === state.swings.at(-1)!.side) {
      if (this.isBeyondLevel(bars[pivot.index], state.swings.at(-1)!)) {
        state.swings[state.swings.length - 1] = pivot;
      }
    } else {
      this.confirmSwing(bars, state, state.swings.at(-1)!, state.swings.at(-2), state.swings.at(-3));

      state.swings.push(pivot);
      if (state.swings.length > 3) state.swings.shift();
    }
  }

  private confirmSwing(
    bars: Bar[],
    state: MarketStructureState,
    swing: MarketStructureSwing,
    previousSwing?: MarketStructureSwing,
    previousSameSideSwing?: MarketStructureSwing,
  ): void {
    if (previousSameSideSwing) {
      swing.trend = this.getSwingTrend(swing, previousSameSideSwing, previousSwing?.trend);
    }

    this.drawSwing(bars[swing.index], swing);

    if (swing.trend) {
      state.trend = swing.trend;
      state.reversalLevel = this.getConfirmedReversalLevel(swing, previousSwing, swing.trend.direction);

      for (let index = swing.index + 1; index < bars.length - 1; index++) this.updateTrend(bars, state, index);
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

  private drawSwing(bar: Bar, swing: MarketStructureSwing): void {
    bar.chart ??= {};
    bar.chart.pivotPoint = { space: swing.space, side: swing.side };

    if (swing.trend) {
      bar.chart.pivotPoint.marketStructure = this.getMarketStructureType(swing.side, swing.trend.direction);
    }
  }

  private getConfirmedReversalLevel(
    swing: MarketStructureSwing,
    previousSwing: MarketStructureSwing | undefined,
    direction: Direction,
  ): MarketStructureLevel | undefined {
    const reversalSide: PivotPointSide = this.getReversalSide(direction);
    const reversalSwing: MarketStructureSwing | undefined = swing.side === reversalSide ? swing : previousSwing;

    if (reversalSwing?.trend) {
      return reversalSwing;
    }
  }

  private getMarketStructureType(side: PivotPointSide, direction: Direction): MarketStructureType {
    if (side === PivotPointSide.High) {
      return direction === Direction.Up ? MarketStructureType.HH : MarketStructureType.LH;
    }

    return direction === Direction.Up ? MarketStructureType.HL : MarketStructureType.LL;
  }

  private updateTrend(bars: Bar[], state: MarketStructureState, index: number): void {
    if (!state.reversalLevel || !state.trend) return;

    const brokenLevel: MarketStructureLevel | undefined = this.getBrokenLevel(bars[index], state.reversalLevel, state.swings!);

    if (brokenLevel) {
      const direction: Direction = this.getBreakDirection(brokenLevel.side);
      state.trend = { direction, streak: direction === state.trend.direction ? state.trend.streak : 1 };
      state.reversalLevel = this.getExtreme(bars, state, brokenLevel.index, index, this.getOppositeSide(brokenLevel.side));
    }
  }

  private getBrokenLevel(bar: Bar, reversalLevel: MarketStructureLevel, swings: MarketStructureSwing[]): MarketStructureLevel | undefined {
    if (this.isBeyondLevel(bar, reversalLevel)) return reversalLevel;

    const continuationSwing: MarketStructureSwing | undefined = swings.findLast(
      (swing) => swing.side !== reversalLevel.side && swing.index > reversalLevel.index,
    );

    if (continuationSwing && this.isBeyondLevel(bar, continuationSwing)) {
      return continuationSwing;
    }
  }

  private getExtreme(
    bars: Bar[],
    state: MarketStructureState,
    startIndex: number,
    endIndex: number,
    side: PivotPointSide,
  ): MarketStructureLevel {
    const extreme: MarketStructureLevel = { index: startIndex, price: this.getObservedPrice(bars, state, startIndex, side), side };

    for (let index = startIndex + 1; index <= endIndex; index++) {
      const price: number = this.getObservedPrice(bars, state, index, side);

      if (this.isBeyondPrice(price, extreme)) {
        extreme.index = index;
        extreme.price = price;
      }
    }

    return extreme;
  }

  private getObservedPrice(bars: Bar[], state: MarketStructureState, index: number, side: PivotPointSide): number {
    if (index === state.observedRange!.index) {
      return side === PivotPointSide.High ? state.observedRange!.high : state.observedRange!.low;
    }

    return this.getPrice(bars[index], side);
  }

  private drawTrend(bar: Bar, trend?: MarketStructureStats): void {
    if (trend) {
      bar.chart ??= {};
      bar.chart.marketStructure = { ...trend };
    }
  }

  private getBreakDirection(side: PivotPointSide): Direction {
    return side === PivotPointSide.High ? Direction.Up : Direction.Down;
  }

  private getReversalSide(direction: Direction): PivotPointSide {
    return direction === Direction.Up ? PivotPointSide.Low : PivotPointSide.High;
  }

  private getOppositeSide(side: PivotPointSide): PivotPointSide {
    return side === PivotPointSide.High ? PivotPointSide.Low : PivotPointSide.High;
  }

  private getPrice(bar: Bar, side: PivotPointSide): number {
    return side === PivotPointSide.High ? bar.prices.high : bar.prices.low;
  }

  private isBeyondLevel(bar: Bar, level: MarketStructureLevel): boolean {
    return this.isBeyondPrice(this.getPrice(bar, level.side), level);
  }

  private isBeyondPrice(price: number, level: MarketStructureLevel): boolean {
    return level.side === PivotPointSide.High ? price > level.price : price < level.price;
  }
}
