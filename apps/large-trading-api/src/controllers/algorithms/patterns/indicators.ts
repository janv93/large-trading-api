import { BollingerBands, Bar, BarIndicators, MacdValues, RsiDivergenceData, RsiDivergenceType, TrendLine, TrendLinePosition } from '@shared';
import { LinearFunction } from '@shared';
import Base from '../../../base';

export default class Indicators extends Base {
  constructor() {
    super();
  }

  public addRsi(bars: Bar[], period: number): void {
    // seed initial average gain/loss from first `period` price changes
    let avgGain: number = 0;
    let avgLoss: number = 0;

    for (let i = 1; i <= period; i++) {
      const change: number = bars[i].prices.close - bars[i - 1].prices.close;
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }

    avgGain /= period;
    avgLoss /= period;

    const setRsi = (bar: Bar) => {
      const relativeStrength: number = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      const existingIndicators: BarIndicators | undefined = bar.indicators;
      bar.indicators = { ...existingIndicators, rsi: 100 - 100 / (1 + relativeStrength) };
    };

    setRsi(bars[period]);

    for (let i = period + 1; i < bars.length; i++) {
      const change: number = bars[i].prices.close - bars[i - 1].prices.close;
      const gain: number = change > 0 ? change : 0;
      const loss: number = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      setRsi(bars[i]);
    }
  }

  public addSma(bars: Bar[], period: number): void {
    for (let i = period - 1; i < bars.length; i++) {
      const sum: number = bars.slice(i - period + 1, i + 1).reduce((acc, k) => acc + k.prices.close, 0);
      const smaValue: number = sum / period;
      const existingIndicators: BarIndicators | undefined = bars[i].indicators;
      const existingSmas: Record<number, number> | undefined = existingIndicators?.sma;
      bars[i].indicators = { ...existingIndicators, sma: { ...existingSmas, [period]: smaValue } };
    }
  }

  public addEma(bars: Bar[], period: number): void {
    const smoothingFactor: number = 2 / (period + 1);
    let currentEma: number = bars.slice(0, period).reduce((sum, k) => sum + k.prices.close, 0) / period;

    // seed the first EMA value (at index period-1) using the initial SMA
    const seedBar: Bar = bars[period - 1];
    const seedExistingIndicators: BarIndicators | undefined = seedBar.indicators;
    const seedExistingEmas: Record<number, number> | undefined = seedExistingIndicators?.ema;
    seedBar.indicators = { ...seedExistingIndicators, ema: { ...seedExistingEmas, [period]: currentEma } };

    for (let i = period; i < bars.length; i++) {
      currentEma = (bars[i].prices.close - currentEma) * smoothingFactor + currentEma;
      const bar: Bar = bars[i];
      const existingIndicators: BarIndicators | undefined = bar.indicators;
      const existingEmas: Record<number, number> | undefined = existingIndicators?.ema;
      bar.indicators = { ...existingIndicators, ema: { ...existingEmas, [period]: currentEma } };
    }
  }

  public addMacd(bars: Bar[], fast: number, slow: number, signal: number): void {
    const closes: number[] = bars.map(k => k.prices.close);

    const fastEmas: number[] = this.calcEmaFromValues(closes, fast);
    const slowEmas: number[] = this.calcEmaFromValues(closes, slow);

    // MACD line is available from index (slow - 1) in the bars array
    // fastEmas and slowEmas both cover the same range starting at their respective period-1
    // fastEmas[i] corresponds to closes[fast - 1 + i], slowEmas[i] to closes[slow - 1 + i]
    // align: macdLine[i] = fastEmas[i + (slow - fast)] - slowEmas[i]
    const macdLine: number[] = slowEmas.map((slowEma, i) => fastEmas[i + (slow - fast)] - slowEma);

    const signalLine: number[] = this.calcEmaFromValues(macdLine, signal);

    // signalLine[i] corresponds to macdLine[i + signal - 1]
    // bar index for signalLine[i] = (slow - 1) + (signal - 1) + i
    const firstSignalBarIndex: number = slow - 1 + signal - 1;

    signalLine.forEach((signalValue: number, i: number) => {
      const macdValue: number = macdLine[i + signal - 1];
      const histogram: number = macdValue - signalValue;
      const barIndex: number = firstSignalBarIndex + i;
      const macdValues: MacdValues = { macdLine: macdValue, signal: signalValue, histogram };
      const bar: Bar = bars[barIndex];
      const existingIndicators: BarIndicators | undefined = bar.indicators;
      bar.indicators = { ...existingIndicators, macd: macdValues };
    });
  }

  /** calculates EMA for a raw number array, returns values starting after the first full period */
  private calcEmaFromValues(values: number[], period: number): number[] {
    const smoothingFactor: number = 2 / (period + 1);
    let currentEma: number = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const result: number[] = [currentEma];

    for (let i = period; i < values.length; i++) {
      currentEma = (values[i] - currentEma) * smoothingFactor + currentEma;
      result.push(currentEma);
    }

    return result;
  }

  public addAtr(bars: Bar[], period: number): void {
    const trueRanges: number[] = [];

    for (let i = 1; i < bars.length; i++) {
      const high: number = bars[i].prices.high;
      const low: number = bars[i].prices.low;
      const prevClose: number = bars[i - 1].prices.close;
      trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }

    let currentAtr: number = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const firstBar: Bar = bars[period];
    firstBar.indicators = { ...firstBar.indicators, atr: currentAtr };

    for (let i = period; i < trueRanges.length; i++) {
      currentAtr = (currentAtr * (period - 1) + trueRanges[i]) / period;
      const bar: Bar = bars[i + 1];
      const existingIndicators: BarIndicators | undefined = bar.indicators;
      bar.indicators = { ...existingIndicators, atr: currentAtr };
    }
  }

  public addBb(bars: Bar[], period: number): void {
    for (let i = period - 1; i < bars.length; i++) {
      const windowBars: Bar[] = bars.slice(i - period + 1, i + 1);
      const middleBand: number = windowBars.reduce((sum, k) => sum + k.prices.close, 0) / period;
      const variance: number = windowBars.reduce((sum, k) => sum + Math.pow(k.prices.close - middleBand, 2), 0) / period;
      const stdDev: number = Math.sqrt(variance);
      const bar: Bar = bars[i];
      const existingIndicators: BarIndicators | undefined = bar.indicators;
      bar.indicators = { ...existingIndicators, bb: { upper: middleBand + 2 * stdDev, middle: middleBand, lower: middleBand - 2 * stdDev } as BollingerBands };
    }
  }

  // assumes trend lines are added
  public addRsiDivergence(bars: Bar[], minStrength: number): void {
    // accumulate divergence strengths per end-bar index
    const bullishStrengths: Map<number, number> = new Map();
    const bearishStrengths: Map<number, number> = new Map();
    const hiddenBullishStrengths: Map<number, number> = new Map();
    const hiddenBearishStrengths: Map<number, number> = new Map();

    for (let i = 0; i < bars.length; i++) {
      const trendLines: TrendLine[] | undefined = bars[i].chart?.trendLines;
      if (!trendLines) continue;

      bars[i].chart!.trendLines = trendLines.filter(trendLine =>
        this.accumulateDivergenceStrength(bars, trendLine, minStrength, bullishStrengths, bearishStrengths, hiddenBullishStrengths, hiddenBearishStrengths)
      );
    }

    // collect all end indices that have any divergence
    const allEndIndices: Set<number> = new Set([
      ...bullishStrengths.keys(),
      ...bearishStrengths.keys(),
      ...hiddenBullishStrengths.keys(),
      ...hiddenBearishStrengths.keys(),
    ]);

    for (const endIndex of allEndIndices) {
      const rsiDivergence: RsiDivergenceData = this.buildRsiDivergenceData(
        bullishStrengths.get(endIndex) ?? 0,
        bearishStrengths.get(endIndex) ?? 0,
        hiddenBullishStrengths.get(endIndex) ?? 0,
        hiddenBearishStrengths.get(endIndex) ?? 0,
      );
      const bar: Bar = bars[endIndex];
      bar.indicators = { ...bar.indicators, rsiDivergence };
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