import { Bar, EmaState, MacdStepState } from '@shared';

export function stepMacd(bars: Bar[], state: MacdStepState, fast: number, slow: number, signal: number): void {
  state.fastEma ??= {};
  state.slowEma ??= {};
  state.signalEma ??= {};
  state.closesBuffer ??= [];
  state.macdLineBuffer ??= [];

  state.closesBuffer.push(bars[bars.length - 1].prices.close);
  const fastEmaValue: number | undefined = stepEmaFromValues(state.closesBuffer, state.fastEma, fast);
  const slowEmaValue: number | undefined = stepEmaFromValues(state.closesBuffer, state.slowEma, slow);

  if (fastEmaValue === undefined || slowEmaValue === undefined) return;

  const macdLineValue: number = fastEmaValue - slowEmaValue;
  state.macdLineBuffer.push(macdLineValue);

  const signalValue: number | undefined = stepEmaFromValues(state.macdLineBuffer, state.signalEma, signal);
  if (signalValue === undefined) return;

  const bar: Bar = bars[bars.length - 1];
  bar.indicators = { ...bar.indicators, macd: { macdLine: macdLineValue, signal: signalValue, histogram: macdLineValue - signalValue } };
}

function stepEmaFromValues(values: number[], state: EmaState, period: number): number | undefined {
  const i: number = values.length - 1;
  if (i < period - 1) return undefined;

  if (state.currentEma === undefined) {
    state.currentEma = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  } else {
    const smoothingFactor: number = 2 / (period + 1);
    state.currentEma = (values[i] - state.currentEma) * smoothingFactor + state.currentEma;
  }

  return state.currentEma;
}