import { Bar, EmaState } from '@shared';

export function stepEma(bars: Bar[], state: EmaState, period: number): void {
  const i: number = bars.length - 1;
  if (i < period - 1) return;

  if (state.currentEma === undefined) {
    state.currentEma = bars.slice(0, period).reduce((sum, bar) => sum + bar.prices.close, 0) / period;
  } else {
    const smoothingFactor: number = 2 / (period + 1);
    state.currentEma = (bars[i].prices.close - state.currentEma) * smoothingFactor + state.currentEma;
  }

  const bar: Bar = bars[i];
  bar.indicators = { ...bar.indicators, ema: { ...bar.indicators?.ema, [period]: state.currentEma } };
}