import { Bar } from '@shared';

export function stepSma(bars: Bar[], period: number): void {
  const i: number = bars.length - 1;
  if (i < period - 1) return;

  const smaValue: number = bars.slice(-period).reduce((sum, bar) => sum + bar.prices.close, 0) / period;
  const bar: Bar = bars[i];
  bar.indicators = { ...bar.indicators, sma: { ...bar.indicators?.sma, [period]: smaValue } };
}