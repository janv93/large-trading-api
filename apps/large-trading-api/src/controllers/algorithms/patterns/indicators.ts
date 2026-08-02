import { AtrState, BollingerBands, Bar, EmaState, MacdStepState, RsiDivergenceData, RsiDivergenceType, RsiState, TrendLine, TrendLinePosition, TrendLineStepState, TrendLinesFromPivotPointsStepState } from '@shared';
import { LinearFunction } from '@shared';
import Base from '../../../base';

export default class Indicators extends Base {
  constructor() {
    super();
  }

  public stepRsi(bars: Bar[], state: RsiState, period: number): void {
    const i: number = bars.length - 1;
    if (i < period) return;

    if (state.avgGain === undefined || state.avgLoss === undefined) {
      state.avgGain = 0;
      state.avgLoss = 0;

      for (let j = 1; j <= period; j++) {
        const change: number = bars[j].prices.close - bars[j - 1].prices.close;
        if (change > 0) state.avgGain += change;
        else state.avgLoss += Math.abs(change);
      }

      state.avgGain /= period;
      state.avgLoss /= period;
    } else {
      const change: number = bars[i].prices.close - bars[i - 1].prices.close;
      const gain: number = change > 0 ? change : 0;
      const loss: number = change < 0 ? Math.abs(change) : 0;
      state.avgGain = (state.avgGain * (period - 1) + gain) / period;
      state.avgLoss = (state.avgLoss * (period - 1) + loss) / period;
    }

    const relativeStrength: number = state.avgLoss === 0 ? Infinity : state.avgGain / state.avgLoss;
    const bar: Bar = bars[i];
    bar.indicators = { ...bar.indicators, rsi: 100 - 100 / (1 + relativeStrength) };
  }

  public stepSma(bars: Bar[], period: number): void {
    const i: number = bars.length - 1;
    if (i < period - 1) return;

    const smaValue: number = bars.slice(-period).reduce((sum, k) => sum + k.prices.close, 0) / period;
    const bar: Bar = bars[i];
    bar.indicators = { ...bar.indicators, sma: { ...bar.indicators?.sma, [period]: smaValue } };
  }

  public stepEma(bars: Bar[], state: EmaState, period: number): void {
    const i: number = bars.length - 1;
    if (i < period - 1) return;

    if (state.currentEma === undefined) {
      state.currentEma = bars.slice(0, period).reduce((sum, k) => sum + k.prices.close, 0) / period;
    } else {
      const smoothingFactor: number = 2 / (period + 1);
      state.currentEma = (bars[i].prices.close - state.currentEma) * smoothingFactor + state.currentEma;
    }

    const bar: Bar = bars[i];
    bar.indicators = { ...bar.indicators, ema: { ...bar.indicators?.ema, [period]: state.currentEma } };
  }

  public stepMacd(bars: Bar[], state: MacdStepState, fast: number, slow: number, signal: number): void {
    state.fastEma ??= {};
    state.slowEma ??= {};
    state.signalEma ??= {};
    state.closesBuffer ??= [];
    state.macdLineBuffer ??= [];

    state.closesBuffer.push(bars[bars.length - 1].prices.close);
    const fastEmaValue: number | undefined = this.stepEmaFromValues(state.closesBuffer, state.fastEma, fast);
    const slowEmaValue: number | undefined = this.stepEmaFromValues(state.closesBuffer, state.slowEma, slow);

    if (fastEmaValue === undefined || slowEmaValue === undefined) return;

    const macdLineValue: number = fastEmaValue - slowEmaValue;
    state.macdLineBuffer.push(macdLineValue);

    const signalValue: number | undefined = this.stepEmaFromValues(state.macdLineBuffer, state.signalEma, signal);
    if (signalValue === undefined) return;

    const bar: Bar = bars[bars.length - 1];
    bar.indicators = { ...bar.indicators, macd: { macdLine: macdLineValue, signal: signalValue, histogram: macdLineValue - signalValue } };
  }

  private stepEmaFromValues(values: number[], state: EmaState, period: number): number | undefined {
    const i: number = values.length - 1;
    if (i < period - 1) return undefined;

    if (state.currentEma === undefined) {
      state.currentEma = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      const smoothingFactor: number = 2 / (period + 1);
      state.currentEma = (values[i] - state.currentEma) * smoothingFactor + state.currentEma;
    }

    return state.currentEma;
  }


  public stepAtr(bars: Bar[], state: AtrState, period: number): void {
    const i: number = bars.length - 1;
    if (i < period) return;

    const trueRange = (idx: number): number => {
      const high: number = bars[idx].prices.high;
      const low: number = bars[idx].prices.low;
      const prevClose: number = bars[idx - 1].prices.close;
      return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    };

    if (state.currentAtr === undefined) {
      state.currentAtr = 0;
      for (let j = 1; j <= period; j++) state.currentAtr += trueRange(j);
      state.currentAtr /= period;
    } else {
      state.currentAtr = (state.currentAtr * (period - 1) + trueRange(i)) / period;
    }

    bars[i].indicators = { ...bars[i].indicators, atr: state.currentAtr };
  }

  public stepBb(bars: Bar[], period: number): void {
    const i: number = bars.length - 1;
    if (i < period - 1) return;

    const window: Bar[] = bars.slice(-period);
    const middleBand: number = window.reduce((sum, k) => sum + k.prices.close, 0) / period;
    const variance: number = window.reduce((sum, k) => sum + Math.pow(k.prices.close - middleBand, 2), 0) / period;
    const stdDev: number = Math.sqrt(variance);
    const bar: Bar = bars[i];
    bar.indicators = { ...bar.indicators, bb: { upper: middleBand + 2 * stdDev, middle: middleBand, lower: middleBand - 2 * stdDev } as BollingerBands };
  }

  public stepRsiDivergence(bars: Bar[], state: TrendLineStepState | TrendLinesFromPivotPointsStepState, minStrength: number): void {
    state.confirmedTrendLines ??= [];
    const i: number = bars.length - 1;

    const bullishStrengths: Map<number, number> = new Map();
    const bearishStrengths: Map<number, number> = new Map();
    const hiddenBullishStrengths: Map<number, number> = new Map();
    const hiddenBearishStrengths: Map<number, number> = new Map();

    for (const trendLine of state.confirmedTrendLines) {
      if (trendLine.endIndex !== i) continue;

      const isDivergence: boolean = this.accumulateDivergenceStrength(bars, trendLine, minStrength, bullishStrengths, bearishStrengths, hiddenBullishStrengths, hiddenBearishStrengths);

      if (!isDivergence) {
        const chart = bars[trendLine.startIndex]?.chart; // only divergence lines stay on the chart
        if (chart?.trendLines) chart.trendLines = chart.trendLines.filter(t => t !== trendLine);
      }
    }

    const rsiDivergence: RsiDivergenceData = this.buildRsiDivergenceData(
      bullishStrengths.get(i) ?? 0,
      bearishStrengths.get(i) ?? 0,
      hiddenBullishStrengths.get(i) ?? 0,
      hiddenBearishStrengths.get(i) ?? 0,
    );

    if (rsiDivergence.regular || rsiDivergence.hidden) {
      bars[i].indicators = { ...bars[i].indicators, rsiDivergence };
    }
  }

  private accumulateDivergenceStrength(
    bars: Bar[],
    trendLine: TrendLine,
    minStrength: number,
    bullishStrengths: Map<number, number>,
    bearishStrengths: Map<number, number>,
    hiddenBullishStrengths: Map<number, number>,
    hiddenBearishStrengths: Map<number, number>,
  ): boolean {
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

    if (priceStdDev === 0 || rsiStdDev === 0) return false;

    const sqrtLength: number = Math.sqrt(length);
    const normalizedPriceSlope: number = Math.tanh((endPrice - startPrice) / (priceStdDev * sqrtLength));
    const normalizedRsiSlope: number = Math.tanh((endRsi - startRsi) / (rsiStdDev * sqrtLength));
    const priceGoesUp: boolean = normalizedPriceSlope > 0;
    const rsiGoesUp: boolean = normalizedRsiSlope > 0;
    const isDivergence: boolean = priceGoesUp !== rsiGoesUp;

    if (!isDivergence) return false;
    if (Math.abs(normalizedPriceSlope) < minStrength || Math.abs(normalizedRsiSlope) < minStrength) return false;
    if (!this.isRsiLineUninterrupted(localRsi, startIndex, endIndex, rsiGoesUp)) return false;

    const strength: number = Math.abs(normalizedPriceSlope - normalizedRsiSlope);
    const position: TrendLinePosition = trendLine.position;

    // regular bullish: price LL (below line going down), RSI higher low
    if (position === TrendLinePosition.Below && !priceGoesUp && rsiGoesUp) {
      bullishStrengths.set(endIndex, (bullishStrengths.get(endIndex) ?? 0) + strength);
    }
    // regular bearish: price HH (above line going up), RSI lower high
    else if (position === TrendLinePosition.Above && priceGoesUp && !rsiGoesUp) {
      bearishStrengths.set(endIndex, (bearishStrengths.get(endIndex) ?? 0) + strength);
    }
    // hidden bullish: price HL (below line going up), RSI lower low
    else if (position === TrendLinePosition.Below && priceGoesUp && !rsiGoesUp) {
      hiddenBullishStrengths.set(endIndex, (hiddenBullishStrengths.get(endIndex) ?? 0) + strength);
    }
    // hidden bearish: price LH (above line going down), RSI higher high
    else if (position === TrendLinePosition.Above && !priceGoesUp && rsiGoesUp) {
      hiddenBearishStrengths.set(endIndex, (hiddenBearishStrengths.get(endIndex) ?? 0) + strength);
    }

    return true;
  }

  private buildRsiDivergenceData(
    bullish: number,
    bearish: number,
    hiddenBullish: number,
    hiddenBearish: number,
  ): RsiDivergenceData {
    const rsiDivergence: RsiDivergenceData = {};

    const regularNet: number = bullish - bearish;
    const regularStrength: number = Math.abs(regularNet);
    if (regularStrength > 0) {
      rsiDivergence.regular = {
        type: regularNet > 0 ? RsiDivergenceType.Bullish : RsiDivergenceType.Bearish,
        strength: regularStrength,
      };
    }

    const hiddenNet: number = hiddenBullish - hiddenBearish;
    const hiddenStrength: number = Math.abs(hiddenNet);
    if (hiddenStrength > 0) {
      rsiDivergence.hidden = {
        type: hiddenNet > 0 ? RsiDivergenceType.HiddenBullish : RsiDivergenceType.HiddenBearish,
        strength: hiddenStrength,
      };
    }

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

  // compute RSI values for indices [startIndex..endIndex], seeded from the `period` candles before startIndex
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
      const rs: number = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      return 100 - 100 / (1 + rs);
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
    const mean: number = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance: number = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}