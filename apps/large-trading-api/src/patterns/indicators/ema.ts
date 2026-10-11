import { Bar } from '@shared';

export function stepEma(bars: Bar[], period: number): void {
  const index: number = bars.length - 1;
  if (index < period - 1) return;

  const previousEma: number | undefined = bars.at(-2)?.indicators?.ema?.[period];
  let currentEma: number;

  if (previousEma === undefined) {
    currentEma = bars.slice(0, period).reduce((sum, bar) => sum + bar.prices.close, 0) / period;
  } else {
    const smoothingFactor: number = 2 / (period + 1);
    currentEma = (bars[index].prices.close - previousEma) * smoothingFactor + previousEma;
  }

  const bar: Bar = bars[index];
  bar.indicators = { ...bar.indicators, ema: { ...bar.indicators?.ema, [period]: currentEma } };
}
