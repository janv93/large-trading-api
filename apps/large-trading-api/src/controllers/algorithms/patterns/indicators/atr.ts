import { AtrState, Bar } from '@shared';

export function stepAtr(bars: Bar[], state: AtrState, period: number): void {
  const i: number = bars.length - 1;
  if (i < period) return;

  const trueRange = (index: number): number => {
    const high: number = bars[index].prices.high;
    const low: number = bars[index].prices.low;
    const previousClose: number = bars[index - 1].prices.close;
    return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
  };

  if (state.currentAtr === undefined) {
    state.currentAtr = 0;
    for (let j = 1; j <= period; j++) state.currentAtr += trueRange(j);
    state.currentAtr /= period;
  } else {
    state.currentAtr = (state.currentAtr * (period - 1) + trueRange(i)) / period;
  }

  bars[i].indicators = { ...bars[i].indicators, atr: state.currentAtr };
}