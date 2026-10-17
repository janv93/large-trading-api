import {
  Bar,
  LinearFunction,
  roundToSignificantDigits,
  Slope,
  TrendLine,
  TrendLinePosition,
  TrendLinesFromPivotPointsStepState,
  TrendLineStepState,
} from '@shared';
import Base from '../../base';

export default abstract class TrendLineBase extends Base {
  protected readonly bufferPercentage = 0.2;
  private readonly breakthroughMaxLengthFactor = 1;

  public stepTrendLineBreakthroughs(
    bars: Bar[],
    state: TrendLineStepState | TrendLinesFromPivotPointsStepState,
    rightBuffer: boolean,
  ): TrendLine[] {
    state.confirmedTrendLines ??= [];
    const i: number = bars.length - 1;
    const newBreakthroughs: TrendLine[] = [];

    state.confirmedTrendLines = state.confirmedTrendLines.filter((trendLine) => {
      if (trendLine.breakThroughIndex !== undefined) return false;
      if (i < trendLine.endIndex + Math.round(trendLine.length * this.breakthroughMaxLengthFactor)) return true;
      this.removeTrendLine(bars, trendLine); // past the max length for a breakthrough, remove it from the chart
      return false;
    });

    for (const trendLine of state.confirmedTrendLines) {
      const buffer: number = rightBuffer ? Math.round(trendLine.length * this.bufferPercentage) : 0;
      const rangeStart: number = trendLine.endIndex + 1 + buffer;

      if (i < rangeStart) continue;

      if (this.crossesTrendLine(bars, trendLine, i)) {
        bars[i].chart = bars[i].chart || {};
        bars[i].chart.trendLineBreakthroughs = bars[i].chart.trendLineBreakthroughs || [];

        if (!this.hasTrendLineBreakthrough(bars[i], trendLine)) {
          bars[i].chart.trendLineBreakthroughs.push(trendLine);
          newBreakthroughs.push(trendLine);
        }

        trendLine.breakThroughIndex = i;
      }
    }

    return newBreakthroughs;
  }

  protected calcSlope(bars: Bar[], startIndex: number, endIndex: number, position: TrendLinePosition): number {
    const startPrice: number = this.getPrice(bars[startIndex], position);
    const endPrice: number = this.getPrice(bars[endIndex], position);
    return roundToSignificantDigits((endPrice - startPrice) / (endIndex - startIndex), 10);
  }

  protected createTrendLine(bars: Bar[], startIndex: number, endIndex: number, position: TrendLinePosition): TrendLine {
    const startPrice: number = this.getPrice(bars[startIndex], position);
    const endPrice: number = this.getPrice(bars[endIndex], position);
    const linearFunction: LinearFunction = new LinearFunction(startIndex, startPrice, endIndex, endPrice);

    return {
      function: linearFunction,
      startIndex,
      endIndex,
      length: endIndex - startIndex,
      slope: linearFunction.m > 0 ? Slope.Ascending : Slope.Descending,
      position,
      againstTrend: this.isTrendLineAgainstTrend(startPrice, endPrice, position),
    };
  }

  protected isTrendLineAccepted(bars: Bar[], trendLine: TrendLine, againstTrend: boolean): boolean {
    if (againstTrend && !trendLine.againstTrend) return false;
    return this.isLeftBufferUninterrupted(bars, trendLine.startIndex, trendLine.endIndex, trendLine.position, trendLine.function);
  }

  protected crossesTrendLine(bars: Bar[], trendLine: TrendLine, index: number): boolean {
    const linePrice: number = trendLine.function.getY(index);
    return trendLine.position === TrendLinePosition.Above ? bars[index].prices.high > linePrice : bars[index].prices.low < linePrice;
  }

  protected confirmTrendLine(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState, trendLine: TrendLine): void {
    if (this.hasConfirmedTrendLine(state, trendLine)) return;
    const startBar: Bar = bars[trendLine.startIndex];
    startBar.chart = startBar.chart || {};
    startBar.chart.trendLines = startBar.chart.trendLines || [];
    startBar.chart.trendLines.push(trendLine);
    state.confirmedTrendLines!.push(trendLine);
  }

  protected isRightBufferCleared(bars: Bar[], trendLine: TrendLine, lastIndex: number): boolean {
    const bufferEnd: number = trendLine.endIndex + Math.round(trendLine.length * this.bufferPercentage);

    for (let index = trendLine.endIndex + 1; index <= Math.min(lastIndex, bufferEnd); index++) {
      if (this.crossesTrendLine(bars, trendLine, index)) return false;
    }

    return true;
  }

  protected isRightBufferClosed(bars: Bar[], trendLine: TrendLine): boolean {
    const bufferEnd: number = trendLine.endIndex + Math.round(trendLine.length * this.bufferPercentage);
    return bars.length - 2 >= bufferEnd;
  }

  protected removeTrendLine(bars: Bar[], trendLine: TrendLine): void {
    const chart = bars[trendLine.startIndex]?.chart;
    if (!chart?.trendLines) return;
    chart.trendLines = chart.trendLines.filter((existing) => !this.isSameTrendLine(existing, trendLine));
  }

  protected updatePendingTrendLines(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState, lastIndex: number): void {
    if (!state.pendingTrendLines?.length) return;

    state.pendingTrendLines = state.pendingTrendLines.filter((trendLine) => {
      if (!this.isRightBufferCleared(bars, trendLine, lastIndex)) return false;
      if (!this.isRightBufferClosed(bars, trendLine)) return true;

      this.confirmTrendLine(bars, state, trendLine);
      return false;
    });
  }

  protected isSameTrendLine(first: TrendLine, second: TrendLine): boolean {
    return this.isSameCurrentBarTrendLine(first, second) && first.endIndex === second.endIndex;
  }

  private getPrice(bar: Bar, position: TrendLinePosition): number {
    return position === TrendLinePosition.Below ? bar.prices.low : bar.prices.high;
  }

  private hasConfirmedTrendLine(state: TrendLineStepState | TrendLinesFromPivotPointsStepState, trendLine: TrendLine): boolean {
    return state.confirmedTrendLines!.some((existing) => this.isSameTrendLine(existing, trendLine));
  }

  private hasTrendLineBreakthrough(bar: Bar, trendLine: TrendLine): boolean {
    return bar.chart!.trendLineBreakthroughs!.some((existing) => this.isSameTrendLine(existing, trendLine));
  }

  private isSameCurrentBarTrendLine(first: TrendLine, second: TrendLine): boolean {
    return first.startIndex === second.startIndex && first.position === second.position;
  }

  private isLeftBufferUninterrupted(
    bars: Bar[],
    startIndex: number,
    endIndex: number,
    position: TrendLinePosition,
    linearFunction: LinearFunction,
  ): boolean {
    const length: number = endIndex - startIndex;
    const buffer: number = Math.round(length * this.bufferPercentage);
    if (startIndex < buffer) return false;

    const crosses = (k: Bar, x: number) =>
      position === TrendLinePosition.Above ? k.prices.high > linearFunction.getY(x) : k.prices.low < linearFunction.getY(x);
    return bars.slice(startIndex - buffer, startIndex).every((k, i, arr) => !crosses(k, startIndex - (arr.length - i)));
  }

  private isTrendLineAgainstTrend(startPrice: number, endPrice: number, position: TrendLinePosition): boolean {
    return position === TrendLinePosition.Below ? endPrice > startPrice : endPrice < startPrice;
  }
}
