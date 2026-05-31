import { BollingerBands, Kline, KlineIndicators, MacdValues, RsiDivergenceData, RsiDivergenceType, TrendLine, TrendLinePosition } from '@shared';
import { LinearFunction } from '@shared';
import Base from '../../../base';

export default class Indicators extends Base {
  constructor() {
    super();
  }

  public addRsi(klines: Kline[], period: number): void {
    // seed initial average gain/loss from first `period` price changes
    let avgGain: number = 0;
    let avgLoss: number = 0;

    for (let i = 1; i <= period; i++) {
      const change: number = klines[i].prices.close - klines[i - 1].prices.close;
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }

    avgGain /= period;
    avgLoss /= period;

    const setRsi = (kline: Kline) => {
      const relativeStrength: number = avgLoss === 0 ? Infinity : avgGain / avgLoss;
      const existingIndicators: KlineIndicators | undefined = kline.indicators;
      kline.indicators = { ...existingIndicators, rsi: 100 - 100 / (1 + relativeStrength) };
    };

    setRsi(klines[period]);

    for (let i = period + 1; i < klines.length; i++) {
      const change: number = klines[i].prices.close - klines[i - 1].prices.close;
      const gain: number = change > 0 ? change : 0;
      const loss: number = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      setRsi(klines[i]);
    }
  }

  public addSma(klines: Kline[], period: number): void {
    for (let i = period - 1; i < klines.length; i++) {
      const sum: number = klines.slice(i - period + 1, i + 1).reduce((acc, k) => acc + k.prices.close, 0);
      const smaValue: number = sum / period;
      const existingIndicators: KlineIndicators | undefined = klines[i].indicators;
      const existingSmas: Record<number, number> | undefined = existingIndicators?.sma;
      klines[i].indicators = { ...existingIndicators, sma: { ...existingSmas, [period]: smaValue } };
    }
  }

  public addEma(klines: Kline[], period: number): void {
    const smoothingFactor: number = 2 / (period + 1);
    let currentEma: number = klines.slice(0, period).reduce((sum, k) => sum + k.prices.close, 0) / period;

    // seed the first EMA value (at index period-1) using the initial SMA
    const seedKline: Kline = klines[period - 1];
    const seedExistingIndicators: KlineIndicators | undefined = seedKline.indicators;
    const seedExistingEmas: Record<number, number> | undefined = seedExistingIndicators?.ema;
    seedKline.indicators = { ...seedExistingIndicators, ema: { ...seedExistingEmas, [period]: currentEma } };

    for (let i = period; i < klines.length; i++) {
      currentEma = (klines[i].prices.close - currentEma) * smoothingFactor + currentEma;
      const kline: Kline = klines[i];
      const existingIndicators: KlineIndicators | undefined = kline.indicators;
      const existingEmas: Record<number, number> | undefined = existingIndicators?.ema;
      kline.indicators = { ...existingIndicators, ema: { ...existingEmas, [period]: currentEma } };
    }
  }

  public addMacd(klines: Kline[], fast: number, slow: number, signal: number): void {
    const closes: number[] = klines.map(k => k.prices.close);

    const fastEmas: number[] = this.calcEmaFromValues(closes, fast);
    const slowEmas: number[] = this.calcEmaFromValues(closes, slow);

    // MACD line is available from index (slow - 1) in the klines array
    // fastEmas and slowEmas both cover the same range starting at their respective period-1
    // fastEmas[i] corresponds to closes[fast - 1 + i], slowEmas[i] to closes[slow - 1 + i]
    // align: macdLine[i] = fastEmas[i + (slow - fast)] - slowEmas[i]
    const macdLine: number[] = slowEmas.map((slowEma, i) => fastEmas[i + (slow - fast)] - slowEma);

    const signalLine: number[] = this.calcEmaFromValues(macdLine, signal);

    // signalLine[i] corresponds to macdLine[i + signal - 1]
    // kline index for signalLine[i] = (slow - 1) + (signal - 1) + i
    const firstSignalKlineIndex: number = slow - 1 + signal - 1;

    signalLine.forEach((signalValue: number, i: number) => {
      const macdValue: number = macdLine[i + signal - 1];
      const histogram: number = macdValue - signalValue;
      const klineIndex: number = firstSignalKlineIndex + i;
      const macdValues: MacdValues = { macdLine: macdValue, signal: signalValue, histogram };
      const kline: Kline = klines[klineIndex];
      const existingIndicators: KlineIndicators | undefined = kline.indicators;
      kline.indicators = { ...existingIndicators, macd: macdValues };
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

  public addAtr(klines: Kline[], period: number): void {
    const trueRanges: number[] = [];

    for (let i = 1; i < klines.length; i++) {
      const high: number = klines[i].prices.high;
      const low: number = klines[i].prices.low;
      const prevClose: number = klines[i - 1].prices.close;
      trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }

    let currentAtr: number = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const firstKline: Kline = klines[period];
    firstKline.indicators = { ...firstKline.indicators, atr: currentAtr };

    for (let i = period; i < trueRanges.length; i++) {
      currentAtr = (currentAtr * (period - 1) + trueRanges[i]) / period;
      const kline: Kline = klines[i + 1];
      const existingIndicators: KlineIndicators | undefined = kline.indicators;
      kline.indicators = { ...existingIndicators, atr: currentAtr };
    }
  }

  public addBb(klines: Kline[], period: number): void {
    for (let i = period - 1; i < klines.length; i++) {
      const windowKlines: Kline[] = klines.slice(i - period + 1, i + 1);
      const middleBand: number = windowKlines.reduce((sum, k) => sum + k.prices.close, 0) / period;
      const variance: number = windowKlines.reduce((sum, k) => sum + Math.pow(k.prices.close - middleBand, 2), 0) / period;
      const stdDev: number = Math.sqrt(variance);
      const kline: Kline = klines[i];
      const existingIndicators: KlineIndicators | undefined = kline.indicators;
      kline.indicators = { ...existingIndicators, bb: { upper: middleBand + 2 * stdDev, middle: middleBand, lower: middleBand - 2 * stdDev } as BollingerBands };
    }
  }

  public addRsiDivergence(klines: Kline[], rsiPeriod: number, minStrength: number): void {
    this.addRsi(klines, rsiPeriod);

    // accumulate divergence strengths per end-kline index
    const bullishStrengths: Map<number, number> = new Map();
    const bearishStrengths: Map<number, number> = new Map();
    const hiddenBullishStrengths: Map<number, number> = new Map();
    const hiddenBearishStrengths: Map<number, number> = new Map();

    for (let i = 0; i < klines.length; i++) {
      const trendLines: TrendLine[] | undefined = klines[i].chart?.trendLines;
      if (!trendLines) continue;

      for (const trendLine of trendLines) {
        this.accumulateDivergenceStrength(klines, trendLine, minStrength, bullishStrengths, bearishStrengths, hiddenBullishStrengths, hiddenBearishStrengths);
      }
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
      const kline: Kline = klines[endIndex];
      kline.indicators = { ...kline.indicators, rsiDivergence };
    }
  }

  private accumulateDivergenceStrength(
    klines: Kline[],
    trendLine: TrendLine,
    minStrength: number,
    bullishStrengths: Map<number, number>,
    bearishStrengths: Map<number, number>,
    hiddenBullishStrengths: Map<number, number>,
    hiddenBearishStrengths: Map<number, number>,
  ): void {
    const startIndex: number = trendLine.startIndex;
    const endIndex: number = trendLine.endIndex;
    const length: number = trendLine.length;

    const startRsi: number | undefined = klines[startIndex].indicators?.rsi;
    const endRsi: number | undefined = klines[endIndex].indicators?.rsi;
    const startPrice: number = trendLine.function.getY(startIndex);
    const endPrice: number = trendLine.function.getY(endIndex);

    if (startRsi === undefined || endRsi === undefined) return;

    const priceStdDev: number = this.calcCloseChangeStdDev(klines, startIndex, endIndex);
    const rsiStdDev: number = this.calcRsiChangeStdDev(klines, startIndex, endIndex);

    if (priceStdDev === 0 || rsiStdDev === 0) return;

    const sqrtLength: number = Math.sqrt(length);
    const normalizedPriceSlope: number = Math.tanh((endPrice - startPrice) / (priceStdDev * sqrtLength));
    const normalizedRsiSlope: number = Math.tanh((endRsi - startRsi) / (rsiStdDev * sqrtLength));
    const priceGoesUp: boolean = normalizedPriceSlope > 0;
    const rsiGoesUp: boolean = normalizedRsiSlope > 0;
    const isDivergence: boolean = priceGoesUp !== rsiGoesUp;

    if (!isDivergence) return;
    if (Math.abs(normalizedPriceSlope) < minStrength || Math.abs(normalizedRsiSlope) < minStrength) return;
    if (!this.isRsiLineUninterrupted(klines, startIndex, endIndex, rsiGoesUp)) return;

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

  private isRsiLineUninterrupted(klines: Kline[], startIndex: number, endIndex: number, rsiGoesUp: boolean): boolean {
    const startRsi: number = klines[startIndex].indicators!.rsi!;
    const endRsi: number = klines[endIndex].indicators!.rsi!;
    const rsiLine: LinearFunction = new LinearFunction(startIndex, startRsi, endIndex, endRsi);

    for (let i = startIndex + 1; i < endIndex; i++) {
      const rsi: number = klines[i].indicators!.rsi!;
      const lineValue: number = rsiLine.getY(i);
      if (rsiGoesUp && rsi < lineValue) return false;
      if (!rsiGoesUp && rsi > lineValue) return false;
    }

    return true;
  }

  private calcCloseChangeStdDev(klines: Kline[], startIndex: number, endIndex: number): number {
    const changes: number[] = [];
    for (let i = startIndex + 1; i <= endIndex; i++) {
      changes.push(klines[i].prices.close - klines[i - 1].prices.close);
    }
    return this.calcStdDev(changes);
  }

  private calcRsiChangeStdDev(klines: Kline[], startIndex: number, endIndex: number): number {
    const changes: number[] = [];
    for (let i = startIndex + 1; i <= endIndex; i++) {
      const prevRsi: number | undefined = klines[i - 1].indicators?.rsi;
      const currRsi: number | undefined = klines[i].indicators?.rsi;
      if (prevRsi !== undefined && currRsi !== undefined) {
        changes.push(currRsi - prevRsi);
      }
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