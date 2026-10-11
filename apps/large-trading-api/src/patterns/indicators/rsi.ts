import { Bar, RsiValues } from '@shared';

export function stepRsi(bars: Bar[], period: number): void {
  const index: number = bars.length - 1;
  if (index < period) return;

  const previousRsi: RsiValues | undefined = bars.at(-2)?.indicators?.rsi;
  let avgGain: number = 0;
  let avgLoss: number = 0;

  if (previousRsi === undefined) {
    for (let barIndex = 1; barIndex <= period; barIndex++) {
      const change: number = bars[barIndex].prices.close - bars[barIndex - 1].prices.close;
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }

    avgGain /= period;
    avgLoss /= period;
  } else {
    const change: number = bars[index].prices.close - bars[index - 1].prices.close;
    const gain: number = change > 0 ? change : 0;
    const loss: number = change < 0 ? Math.abs(change) : 0;
    avgGain = (previousRsi.avgGain * (period - 1) + gain) / period;
    avgLoss = (previousRsi.avgLoss * (period - 1) + loss) / period;
  }

  const relativeStrength: number = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  const bar: Bar = bars[index];
  bar.indicators = { ...bar.indicators, rsi: { value: 100 - 100 / (1 + relativeStrength), avgGain, avgLoss } };
}
