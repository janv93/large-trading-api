import { BollingerBands, KlineIndicators, Kline, MacdValues } from '@shared';

export default class Indicators {
  constructor() {
  }

  public rsi(klines: Kline[], period: number): void {
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

  public sma(klines: Kline[], period: number): void {
    for (let i = period - 1; i < klines.length; i++) {
      const sum: number = klines.slice(i - period + 1, i + 1).reduce((acc, k) => acc + k.prices.close, 0);
      const smaValue: number = sum / period;
      const existingIndicators: KlineIndicators | undefined = klines[i].indicators;
      const existingSmas: Record<number, number> | undefined = existingIndicators?.sma;
      klines[i].indicators = { ...existingIndicators, sma: { ...existingSmas, [period]: smaValue } };
    }
  }

  public ema(klines: Kline[], period: number): void {
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

  public macd(klines: Kline[], fast: number, slow: number, signal: number): void {
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

  public atr(klines: Kline[], period: number): void {
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

  public bb(klines: Kline[], period: number): void {
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
}