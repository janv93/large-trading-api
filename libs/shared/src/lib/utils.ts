import { cloneDeep } from 'lodash';
import { Algorithm, Bar, Signal, Timeframe, TickerMetrics } from './interfaces';

/**
 * 1 = green, -1 = red, 0 = steady
 */
export function getBarColor(bar: Bar): 1 | -1 | 0 {
  const diff = Number(bar.prices.close) - Number(bar.prices.open);
  return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
}

export function timeframeToMilliseconds(timeframe: Timeframe): number {
  const unit = timeframe.slice(-1);
  const value = Number(timeframe.slice(0, timeframe.length - 1));

  switch (unit) {
    case 'm': return value * 60000;
    case 'h': return value * 60 * 60000;
    case 'd': return value * 24 * 60 * 60000;
    case 'w': return value * 7 * 24 * 60 * 60000;
    case 'M': return value * 30 * 24 * 60 * 60000;
    default: return -1;
  }
}

export function timeframeToSeconds(timeframe: Timeframe): number {
  return timeframeToMilliseconds(timeframe) / 1000;
}

export function timeframeToMinutes(timeframe: Timeframe): number {
  return timeframeToSeconds(timeframe) / 60;
}

export function createUrl(baseUrl: string, queryObj: any): string {
  let url = baseUrl;
  let firstParam = true;

  Object.keys(queryObj).forEach(param => {
    const query = param + '=' + queryObj[param];
    url += firstParam ? '?' : '&';
    url += query;
    firstParam = false;
  });

  return url;
}

export function createQuery(queryObj: any): string {
  let url = '';
  let firstParam = true;

  Object.keys(queryObj).forEach(param => {
    const query = param + '=' + queryObj[param];
    url += firstParam ? '?' : '&';
    url += query;
    firstParam = false;
  });

  return url;
}

export function timestampToDate(timestamp: number): string {
  return (new Date(timestamp)).toLocaleString('de-DE', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timestampsToDateRange(timestampStart: number, timestampEnd: number): string {
  return `From ${timestampToDate(timestampStart)} to ${timestampToDate(timestampEnd)}`;
}

export function calcStartTime(timeframe: Timeframe): number {
  const unit = timeframe.slice(-1);
  const value = Number(timeframe.slice(0, timeframe.length - 1));
  const ms = timeframeToMilliseconds(timeframe);
  const now = Date.now();
  const minTimestamp = 1000000000000; // Sept 2001 — minimum valid 13-digit ms timestamp, relevant for kucoin

  switch (unit) {
    case 'm': return Math.max(now - ms * 100 * 1000, minTimestamp); // 100k * 1 min = 69 days - 100k * 15 min = 1k days
    case 'h': return Math.max(now - ms * Math.round(100 / value) * 1000, minTimestamp); // 100k hours = 4k days
    case 'd': return Math.max(now - ms * Math.round(10 / value) * 1000, minTimestamp); // 10k days = 27 years
    case 'w': return Math.max(now - ms * 1000, minTimestamp); // 1k weeks = 38 years
    case 'M': return Math.max(now - ms * 100, minTimestamp);
    default: throw `timeframe ${timeframe} does not exist`;
  }
}

export function isBarOutdated(timeframe: Timeframe, lastOpen: number, lastFetch?: number): boolean {
  const unit = timeframe.slice(-1);
  const now = Date.now();
  const timeframeMs = timeframeToMilliseconds(timeframe);

  // e.g. if timeframe 1h and last fetch < 1h ago there are no new bars
  if (lastFetch && (now - lastFetch) < timeframeMs) return false;

  const diff = now - lastOpen;
  switch (unit) {
    case 'm': return diff > 15 * 60 * 1000; // 15 min
    default: return diff > 3 * timeframeMs; // 3 timeframes for anything > minutes
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise<void>(r => setTimeout(r, ms));
}

export function calcTickerMetrics(bars: Bar[], algorithm: Algorithm): TickerMetrics {
  let peak = 0;
  let maxDrawdown = 0;
  let signalCount = 0;

  for (const bar of bars) {
    const profit = bar.algorithms[algorithm]?.profit ?? 0;
    if (profit > peak) peak = profit;
    const drawdown = peak - profit;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    signalCount += bar.algorithms[algorithm]?.signals?.length ?? 0;
  }

  const rawProfit = bars.at(-1)?.algorithms[algorithm]?.profit ?? 0;
  const sign = rawProfit >= 0 ? 1 : -1;
  const sqrtProfit = rawProfit === 0 ? 0 : sign * Math.sqrt(Math.abs(rawProfit));
  const maxDrawdownRatio = peak <= 0 ? 1 : Math.min(maxDrawdown / peak, 1);
  return { sqrtProfit, maxDrawdownRatio, signalCount };
}

export function calcScore(tickers: Bar[][], algorithm: Algorithm): number {
  const metrics: TickerMetrics[] = tickers.map(t => calcTickerMetrics(t, algorithm));
  if (metrics.length === 0) return 0;

  const totalWeight = metrics.reduce((sum, m) => sum + Math.sqrt(m.signalCount), 0);

  // less signals = less weight
  const avgMaxDrawdownRatio: number = metrics.reduce((sum, m) => sum + m.maxDrawdownRatio * Math.sqrt(m.signalCount), 0) / totalWeight;
  const avgSqrtProfit: number = metrics.reduce((sum, m) => sum + m.sqrtProfit * Math.sqrt(m.signalCount), 0) / totalWeight;
  const profitableRatio: number = metrics.reduce((sum, m) => sum + (m.sqrtProfit > 0 ? Math.sqrt(m.signalCount) : 0), 0) / totalWeight;
  return avgSqrtProfit * profitableRatio * (1 - avgMaxDrawdownRatio);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function clone<T>(original: T): T {
  return cloneDeep(original);
}

export function calcAverage(numbers: number[]): number {
  return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}

export function calcAverageChangeInPercent(numbers: number[]): number {
  if (numbers.length < 2) return 0;
  let totalChange = 0;

  for (let i = 1; i < numbers.length; i++) {
    const change = Math.abs(numbers[i] - numbers[i - 1]) / numbers[i - 1];
    totalChange += change;
  }

  return totalChange / (numbers.length - 1);
}

// e.g. 10 -> 15 = 0.5
export function calcPriceChange(startPrice: number, endPrice: number): number {
  return (endPrice - startPrice) / startPrice;
}

export function isCloseSignal(signal?: Signal): boolean {
  if (!signal) return false;
  return [Signal.CloseAll, Signal.Close, Signal.Liquidation, Signal.TakeProfit, Signal.StopLoss].includes(signal);
}

export function isForceCloseSignal(signal?: Signal): boolean {
  const isClose: boolean = isCloseSignal(signal);
  return isClose && signal !== Signal.CloseAll && signal !== Signal.Close;
}
