import {
  Bar,
  DetectedRsiDivergence,
  LinearFunction,
  RsiDivergenceData,
  RsiDivergenceStrengths,
  TrendLine,
  TrendLinePosition,
  TrendLineStepState,
} from '@shared';
import TrendLineController from './trend-line';

export default class RsiDivergenceController extends TrendLineController {
  public stepRsiDivergence(bars: Bar[], state: TrendLineStepState, minStrength: number): RsiDivergenceData | undefined {
    state.confirmedTrendLines ??= [];
    const i: number = bars.length - 1;
    const bar: Bar = bars[i];
    const currentRsiDivergence: RsiDivergenceData | undefined = bar.indicators?.rsiDivergence;
    const newDivergences: DetectedRsiDivergence[] = [];

    for (const trendLine of state.confirmedTrendLines) {
      this.removeLineWithoutDivergence(bars, state, trendLine);
      if (trendLine.endIndex !== i) continue;
      if (currentRsiDivergence?.originTrendLines.some((origin) => this.isSameTrendLine(origin, trendLine))) continue;

      const divergence: RsiDivergenceStrengths | undefined = this.calcRsiDivergence(bars, trendLine, minStrength);
      if (divergence) newDivergences.push({ ...divergence, originTrendLine: trendLine });
    }

    if (!newDivergences.length) return undefined;

    const newRsiDivergence: RsiDivergenceData = this.buildRsiDivergenceData(newDivergences);
    const rsiDivergence: RsiDivergenceData = this.mergeRsiDivergenceData(currentRsiDivergence, newRsiDivergence);
    bar.indicators = { ...bar.indicators, rsiDivergence };
    return newRsiDivergence;
  }

  private removeLineWithoutDivergence(bars: Bar[], state: TrendLineStepState, trendLine: TrendLine): void {
    const previousIndex: number = bars.length - 2;
    const previousRsiDivergence: RsiDivergenceData | undefined = bars[previousIndex]?.indicators?.rsiDivergence;

    if (
      trendLine.endIndex === previousIndex &&
      !previousRsiDivergence?.originTrendLines.some((origin) => this.isSameTrendLine(origin, trendLine))
    ) {
      state.confirmedTrendLines = state.confirmedTrendLines!.filter((line) => line !== trendLine);
      this.removeTrendLine(bars, trendLine);
    }
  }

  private calcRsiDivergence(bars: Bar[], trendLine: TrendLine, minStrength: number): RsiDivergenceStrengths | undefined {
    const startIndex: number = trendLine.startIndex;
    const endIndex: number = trendLine.endIndex;
    const length: number = trendLine.length;
    const period: number = Math.floor(length / 2);

    const localRsi: number[] = this.calcLocalRsi(bars, startIndex, endIndex, period);
    const startRsi: number = localRsi[0];
    const endRsi: number = localRsi[localRsi.length - 1];
    const startPrice: number = trendLine.function.getY(startIndex);
    const endPrice: number = trendLine.function.getY(endIndex);

    const priceStdDev: number = this.calcCloseChangeStdDev(bars, startIndex, endIndex);
    const rsiStdDev: number = this.calcRsiChangeStdDev(localRsi);

    if (priceStdDev === 0 || rsiStdDev === 0) return undefined;

    const sqrtLength: number = Math.sqrt(length);
    const normalizedPriceSlope: number = Math.tanh((endPrice - startPrice) / (priceStdDev * sqrtLength));
    const normalizedRsiSlope: number = Math.tanh((endRsi - startRsi) / (rsiStdDev * sqrtLength));
    const priceGoesUp: boolean = normalizedPriceSlope > 0;
    const rsiGoesUp: boolean = normalizedRsiSlope > 0;
    const isDivergence: boolean = priceGoesUp !== rsiGoesUp;

    if (!isDivergence) return undefined;
    if (Math.abs(normalizedPriceSlope) < minStrength || Math.abs(normalizedRsiSlope) < minStrength) return undefined;
    if (!this.isRsiLineUninterrupted(localRsi, startIndex, endIndex, rsiGoesUp)) return undefined;

    const strength: number = Math.abs(normalizedPriceSlope - normalizedRsiSlope);
    const position: TrendLinePosition = trendLine.position;

    if (position === TrendLinePosition.Below && !priceGoesUp && rsiGoesUp) {
      return { regular: strength };
    } else if (position === TrendLinePosition.Above && priceGoesUp && !rsiGoesUp) {
      return { regular: -strength };
    } else if (position === TrendLinePosition.Below && priceGoesUp && !rsiGoesUp) {
      return { hidden: strength };
    } else if (position === TrendLinePosition.Above && !priceGoesUp && rsiGoesUp) {
      return { hidden: -strength };
    }

    return undefined;
  }

  private buildRsiDivergenceData(divergences: DetectedRsiDivergence[]): RsiDivergenceData {
    const regular: number = divergences.reduce((sum, divergence) => sum + (divergence.regular ?? 0), 0);
    const hidden: number = divergences.reduce((sum, divergence) => sum + (divergence.hidden ?? 0), 0);

    return this.createRsiDivergenceData(
      regular,
      hidden,
      divergences.map((divergence) => divergence.originTrendLine),
    );
  }

  private mergeRsiDivergenceData(current: RsiDivergenceData | undefined, added: RsiDivergenceData): RsiDivergenceData {
    const regular: number = (current?.regular ?? 0) + (added.regular ?? 0);
    const hidden: number = (current?.hidden ?? 0) + (added.hidden ?? 0);
    return this.createRsiDivergenceData(regular, hidden, [...(current?.originTrendLines ?? []), ...added.originTrendLines]);
  }

  private createRsiDivergenceData(regular: number, hidden: number, originTrendLines: TrendLine[]): RsiDivergenceData {
    const rsiDivergence: RsiDivergenceData = { originTrendLines };

    if (regular !== 0) rsiDivergence.regular = regular;
    if (hidden !== 0) rsiDivergence.hidden = hidden;

    return rsiDivergence;
  }

  private isRsiLineUninterrupted(localRsi: number[], startIndex: number, endIndex: number, rsiGoesUp: boolean): boolean {
    const startRsi: number = localRsi[0];
    const endRsi: number = localRsi[localRsi.length - 1];
    const rsiLine: LinearFunction = new LinearFunction(startIndex, startRsi, endIndex, endRsi);

    for (let i = 1; i < localRsi.length - 1; i++) {
      const rsi: number = localRsi[i];
      const lineValue: number = rsiLine.getY(startIndex + i);
      if (rsiGoesUp && rsi < lineValue) return false;
      if (!rsiGoesUp && rsi > lineValue) return false;
    }

    return true;
  }

  private calcLocalRsi(bars: Bar[], startIndex: number, endIndex: number, period: number): number[] {
    const seedStart: number = Math.max(0, startIndex - period);
    const seedCount: number = startIndex - seedStart;

    let avgGain: number = 0;
    let avgLoss: number = 0;

    for (let i = seedStart + 1; i <= startIndex; i++) {
      const change: number = bars[i].prices.close - bars[i - 1].prices.close;
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }

    if (seedCount > 0) {
      avgGain /= seedCount;
      avgLoss /= seedCount;
    }

    const getRsi = (): number => {
      const relativeStrength: number = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      return 100 - 100 / (1 + relativeStrength);
    };

    const rsiValues: number[] = new Array(endIndex - startIndex + 1);
    rsiValues[0] = getRsi();

    for (let i = startIndex + 1; i <= endIndex; i++) {
      const change: number = bars[i].prices.close - bars[i - 1].prices.close;
      const gain: number = change > 0 ? change : 0;
      const loss: number = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsiValues[i - startIndex] = getRsi();
    }

    return rsiValues;
  }

  private calcCloseChangeStdDev(bars: Bar[], startIndex: number, endIndex: number): number {
    const changes: number[] = [];

    for (let i = startIndex + 1; i <= endIndex; i++) {
      changes.push(bars[i].prices.close - bars[i - 1].prices.close);
    }

    return this.calcStdDev(changes);
  }

  private calcRsiChangeStdDev(localRsi: number[]): number {
    const changes: number[] = [];

    for (let i = 1; i < localRsi.length; i++) {
      changes.push(localRsi[i] - localRsi[i - 1]);
    }

    return this.calcStdDev(changes);
  }

  private calcStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean: number = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance: number = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}
