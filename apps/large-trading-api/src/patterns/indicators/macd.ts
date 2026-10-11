import { Bar } from '@shared';
import { stepEma } from './ema';

export function stepMacd(bars: Bar[], fast: number, slow: number, signal: number): void {
  stepEma(bars, fast);
  stepEma(bars, slow);
  const bar: Bar = bars[bars.length - 1];
  const fastEmaValue: number | undefined = bar.indicators?.ema?.[fast];
  const slowEmaValue: number | undefined = bar.indicators?.ema?.[slow];

  if (fastEmaValue === undefined || slowEmaValue === undefined) return;

  const macdLineValue: number = fastEmaValue - slowEmaValue;
  const signalValue: number | undefined = calcSignal(bars, macdLineValue, fast, slow, signal);
  if (signalValue === undefined) return;

  bar.indicators = { ...bar.indicators, macd: { macdLine: macdLineValue, signal: signalValue, histogram: macdLineValue - signalValue } };
}

function calcSignal(bars: Bar[], macdLineValue: number, fast: number, slow: number, signal: number): number | undefined {
  const previousSignal: number | undefined = bars.at(-2)?.indicators?.macd?.signal;

  if (previousSignal === undefined) {
    const firstMacdIndex: number = Math.max(fast, slow) - 1;
    if (bars.length < firstMacdIndex + signal) return;

    const macdLines: number[] = bars
      .slice(firstMacdIndex, firstMacdIndex + signal)
      .map((bar: Bar) => bar.indicators!.ema![fast] - bar.indicators!.ema![slow]);

    return macdLines.reduce((sum, value) => sum + value, 0) / signal;
  }

  const smoothingFactor: number = 2 / (signal + 1);
  return (macdLineValue - previousSignal) * smoothingFactor + previousSignal;
}
