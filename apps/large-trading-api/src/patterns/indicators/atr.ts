import { Bar } from '@shared';

export function stepAtr(bars: Bar[], period: number): void {
  const closedIndex: number = bars.length - 2;
  if (closedIndex < period) return;

  const previousAtr: number | undefined = bars[closedIndex - 1].indicators?.atr;
  let atr: number = 0;

  if (previousAtr === undefined) {
    for (let barIndex = 1; barIndex <= period; barIndex++) atr += calcTrueRange(bars, barIndex);
    atr /= period;
  } else {
    atr = (previousAtr * (period - 1) + calcTrueRange(bars, closedIndex)) / period;
  }

  const closedBar: Bar = bars[closedIndex];
  closedBar.indicators = { ...closedBar.indicators, atr };
}

function calcTrueRange(bars: Bar[], index: number): number {
  const high: number = bars[index].prices.high;
  const low: number = bars[index].prices.low;
  const previousClose: number = bars[index - 1].prices.close;
  return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
}
