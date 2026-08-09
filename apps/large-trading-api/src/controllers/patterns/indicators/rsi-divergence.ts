import {
  Bar,
  LinearFunction,
  RsiDivergenceData,
  RsiDivergenceType,
  TrendLine,
  TrendLinePosition,
  TrendLineStepState,
  TrendLinesFromPivotPointsStepState,
} from '@shared';

export function stepRsiDivergence(
  bars: Bar[],
  state: TrendLineStepState | TrendLinesFromPivotPointsStepState,
  minStrength: number,
): void {
  state.confirmedTrendLines ??= [];
  const i: number = bars.length - 1;

  const bullishStrengths: Map<number, number> = new Map();
  const bearishStrengths: Map<number, number> = new Map();
  const hiddenBullishStrengths: Map<number, number> = new Map();
  const hiddenBearishStrengths: Map<number, number> = new Map();

  for (const trendLine of state.confirmedTrendLines) {
    if (trendLine.endIndex !== i) continue;

    const isDivergence: boolean = accumulateDivergenceStrength(
      bars,
      trendLine,
      minStrength,
      bullishStrengths,
      bearishStrengths,
      hiddenBullishStrengths,
      hiddenBearishStrengths,
    );

    if (!isDivergence) {
      const chart = bars[trendLine.startIndex]?.chart;
      if (chart?.trendLines) chart.trendLines = chart.trendLines.filter(line => line !== trendLine);
    }
  }

  const rsiDivergence: RsiDivergenceData = buildRsiDivergenceData(
    bullishStrengths.get(i) ?? 0,
    bearishStrengths.get(i) ?? 0,
    hiddenBullishStrengths.get(i) ?? 0,
    hiddenBearishStrengths.get(i) ?? 0,
  );

  if (rsiDivergence.regular || rsiDivergence.hidden) {
    bars[i].indicators = { ...bars[i].indicators, rsiDivergence };
  }
}

function accumulateDivergenceStrength(
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

  const localRsi: number[] = calcLocalRsi(bars, startIndex, endIndex, period);
  const startRsi: number = localRsi[0];
  const endRsi: number = localRsi[localRsi.length - 1];
  const startPrice: number = trendLine.function.getY(startIndex);
  const endPrice: number = trendLine.function.getY(endIndex);

  const priceStdDev: number = calcCloseChangeStdDev(bars, startIndex, endIndex);
  const rsiStdDev: number = calcRsiChangeStdDev(localRsi);

  if (priceStdDev === 0 || rsiStdDev === 0) return false;

  const sqrtLength: number = Math.sqrt(length);
  const normalizedPriceSlope: number = Math.tanh((endPrice - startPrice) / (priceStdDev * sqrtLength));
  const normalizedRsiSlope: number = Math.tanh((endRsi - startRsi) / (rsiStdDev * sqrtLength));
  const priceGoesUp: boolean = normalizedPriceSlope > 0;
  const rsiGoesUp: boolean = normalizedRsiSlope > 0;
  const isDivergence: boolean = priceGoesUp !== rsiGoesUp;

  if (!isDivergence) return false;
  if (Math.abs(normalizedPriceSlope) < minStrength || Math.abs(normalizedRsiSlope) < minStrength) return false;
  if (!isRsiLineUninterrupted(localRsi, startIndex, endIndex, rsiGoesUp)) return false;

  const strength: number = Math.abs(normalizedPriceSlope - normalizedRsiSlope);
  const position: TrendLinePosition = trendLine.position;

  if (position === TrendLinePosition.Below && !priceGoesUp && rsiGoesUp) {
    bullishStrengths.set(endIndex, (bullishStrengths.get(endIndex) ?? 0) + strength);
  } else if (position === TrendLinePosition.Above && priceGoesUp && !rsiGoesUp) {
    bearishStrengths.set(endIndex, (bearishStrengths.get(endIndex) ?? 0) + strength);
  } else if (position === TrendLinePosition.Below && priceGoesUp && !rsiGoesUp) {
    hiddenBullishStrengths.set(endIndex, (hiddenBullishStrengths.get(endIndex) ?? 0) + strength);
  } else if (position === TrendLinePosition.Above && !priceGoesUp && rsiGoesUp) {
    hiddenBearishStrengths.set(endIndex, (hiddenBearishStrengths.get(endIndex) ?? 0) + strength);
  }

  return true;
}

function buildRsiDivergenceData(bullish: number, bearish: number, hiddenBullish: number, hiddenBearish: number): RsiDivergenceData {
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

function isRsiLineUninterrupted(localRsi: number[], startIndex: number, endIndex: number, rsiGoesUp: boolean): boolean {
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

function calcLocalRsi(bars: Bar[], startIndex: number, endIndex: number, period: number): number[] {
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

function calcCloseChangeStdDev(bars: Bar[], startIndex: number, endIndex: number): number {
  const changes: number[] = [];
  for (let i = startIndex + 1; i <= endIndex; i++) {
    changes.push(bars[i].prices.close - bars[i - 1].prices.close);
  }
  return calcStdDev(changes);
}

function calcRsiChangeStdDev(localRsi: number[]): number {
  const changes: number[] = [];
  for (let i = 1; i < localRsi.length; i++) {
    changes.push(localRsi[i] - localRsi[i - 1]);
  }
  return calcStdDev(changes);
}

function calcStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean: number = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance: number = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}