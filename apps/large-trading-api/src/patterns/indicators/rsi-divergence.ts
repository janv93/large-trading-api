import {
  Bar,
  LinearFunction,
  RsiDivergenceData,
  TrendLine,
  TrendLinePosition,
  TrendLineStepState,
  TrendLinesFromPivotPointsStepState,
} from '@shared';

interface RsiDivergenceStrengths {
  regular?: number;
  hidden?: number;
}

interface DetectedRsiDivergence extends RsiDivergenceStrengths {
  originTrendLine: TrendLine;
}

export function stepRsiDivergence(
  bars: Bar[],
  state: TrendLineStepState | TrendLinesFromPivotPointsStepState,
  minStrength: number,
): RsiDivergenceData | undefined {
  state.confirmedTrendLines ??= [];
  const i: number = bars.length - 1;
  const bar: Bar = bars[i];
  const currentRsiDivergence: RsiDivergenceData | undefined = bar.indicators?.rsiDivergence;
  const newDivergences: DetectedRsiDivergence[] = [];

  for (const trendLine of state.confirmedTrendLines) {
    if (trendLine.endIndex !== i) continue;
    if (currentRsiDivergence?.originTrendLines.some(origin => isSameTrendLine(origin, trendLine))) continue;

    const divergence: RsiDivergenceStrengths | undefined = calcRsiDivergence(bars, trendLine, minStrength);

    if (!divergence) {
      const chart = bars[trendLine.startIndex]?.chart;
      if (chart?.trendLines) chart.trendLines = chart.trendLines.filter(line => line !== trendLine);
    } else {
      newDivergences.push({ ...divergence, originTrendLine: trendLine });
    }
  }

  if (!newDivergences.length) return undefined;

  const newRsiDivergence: RsiDivergenceData = buildRsiDivergenceData(newDivergences);
  const rsiDivergence: RsiDivergenceData = mergeRsiDivergenceData(currentRsiDivergence, newRsiDivergence);
  bar.indicators = { ...bar.indicators, rsiDivergence };
  return newRsiDivergence;
}

function calcRsiDivergence(
  bars: Bar[],
  trendLine: TrendLine,
  minStrength: number,
): RsiDivergenceStrengths | undefined {
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

  if (priceStdDev === 0 || rsiStdDev === 0) return undefined;

  const sqrtLength: number = Math.sqrt(length);
  const normalizedPriceSlope: number = Math.tanh((endPrice - startPrice) / (priceStdDev * sqrtLength));
  const normalizedRsiSlope: number = Math.tanh((endRsi - startRsi) / (rsiStdDev * sqrtLength));
  const priceGoesUp: boolean = normalizedPriceSlope > 0;
  const rsiGoesUp: boolean = normalizedRsiSlope > 0;
  const isDivergence: boolean = priceGoesUp !== rsiGoesUp;

  if (!isDivergence) return undefined;
  if (Math.abs(normalizedPriceSlope) < minStrength || Math.abs(normalizedRsiSlope) < minStrength) return undefined;
  if (!isRsiLineUninterrupted(localRsi, startIndex, endIndex, rsiGoesUp)) return undefined;

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

function buildRsiDivergenceData(divergences: DetectedRsiDivergence[]): RsiDivergenceData {
  const regular: number = divergences.reduce((sum, divergence) => sum + (divergence.regular ?? 0), 0);
  const hidden: number = divergences.reduce((sum, divergence) => sum + (divergence.hidden ?? 0), 0);

  return createRsiDivergenceData(regular, hidden, divergences.map(divergence => divergence.originTrendLine));
}

function mergeRsiDivergenceData(current: RsiDivergenceData | undefined, added: RsiDivergenceData): RsiDivergenceData {
  const regular: number = (current?.regular ?? 0) + (added.regular ?? 0);
  const hidden: number = (current?.hidden ?? 0) + (added.hidden ?? 0);
  return createRsiDivergenceData(regular, hidden, [...current?.originTrendLines ?? [], ...added.originTrendLines]);
}

function createRsiDivergenceData(regular: number, hidden: number, originTrendLines: TrendLine[]): RsiDivergenceData {
  const rsiDivergence: RsiDivergenceData = { originTrendLines };

  if (regular !== 0) rsiDivergence.regular = regular;
  if (hidden !== 0) rsiDivergence.hidden = hidden;

  return rsiDivergence;
}

function isSameTrendLine(first: TrendLine, second: TrendLine): boolean {
  return first.startIndex === second.startIndex &&
    first.position === second.position;
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