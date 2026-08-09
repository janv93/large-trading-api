import { Bar, RsiState } from '@shared';

export function stepRsi(bars: Bar[], state: RsiState, period: number): void {
  const i: number = bars.length - 1;
  if (i < period) return;

  if (state.avgGain === undefined || state.avgLoss === undefined) {
    state.avgGain = 0;
    state.avgLoss = 0;

    for (let j = 1; j <= period; j++) {
      const change: number = bars[j].prices.close - bars[j - 1].prices.close;
      if (change > 0) state.avgGain += change;
      else state.avgLoss += Math.abs(change);
    }

    state.avgGain /= period;
    state.avgLoss /= period;
  } else {
    const change: number = bars[i].prices.close - bars[i - 1].prices.close;
    const gain: number = change > 0 ? change : 0;
    const loss: number = change < 0 ? Math.abs(change) : 0;
    state.avgGain = (state.avgGain * (period - 1) + gain) / period;
    state.avgLoss = (state.avgLoss * (period - 1) + loss) / period;
  }

  const relativeStrength: number = state.avgLoss === 0 ? Infinity : state.avgGain / state.avgLoss;
  const bar: Bar = bars[i];
  bar.indicators = { ...bar.indicators, rsi: 100 - 100 / (1 + relativeStrength) };
}