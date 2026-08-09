import { Bar, BollingerBands } from '@shared';

export function stepBb(bars: Bar[], period: number): void {
  const i: number = bars.length - 1;
  if (i < period - 1) return;

  const window: Bar[] = bars.slice(-period);
  const middleBand: number = window.reduce((sum, bar) => sum + bar.prices.close, 0) / period;
  const variance: number = window.reduce((sum, bar) => sum + Math.pow(bar.prices.close - middleBand, 2), 0) / period;
  const standardDeviation: number = Math.sqrt(variance);
  const bar: Bar = bars[i];
  bar.indicators = {
    ...bar.indicators,
    bb: { upper: middleBand + 2 * standardDeviation, middle: middleBand, lower: middleBand - 2 * standardDeviation } as BollingerBands,
  };
}