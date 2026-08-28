import { BacktestSignal, Bar, TrendLine } from '@shared';

export function createActiveBar(committed: Bar, price: number, timeframeMs: number, previous?: Bar): Bar {
  const rsiDivergence = previous?.indicators?.rsiDivergence;
  const trendLineBreakthroughs = previous?.chart?.trendLineBreakthroughs;

  return {
    symbol: committed.symbol,
    exchange: committed.exchange,
    ...(committed.feed ? { feed: committed.feed } : {}),
    timeframe: committed.timeframe,
    times: { open: committed.times.open + timeframeMs },
    prices: { open: price, high: price, low: price, close: price },
    volume: 0,
    ...(previous?.candlestickPatterns ? { candlestickPatterns: previous.candlestickPatterns } : {}),
    ...(rsiDivergence ? { indicators: { rsiDivergence } } : {}),
    ...(trendLineBreakthroughs ? { chart: { trendLineBreakthroughs } } : {}),
    backtest: { signals: [...previous?.backtest.signals ?? []] }
  };
}

export function deduplicateActiveBar(bar: Bar): void {
  const identifiers = new Set<string>();
  bar.backtest.signals = bar.backtest.signals.filter(signal => {
    const identifier: string = signal.uniqueIdentifier ?? fallbackSignalIdentifier(signal);
    if (identifiers.has(identifier)) return false;
    identifiers.add(identifier);
    return true;
  });

  const breakthroughs: TrendLine[] | undefined = bar.chart?.trendLineBreakthroughs;
  if (breakthroughs) {
    const trendLineIdentifiers = new Set<string>();
    bar.chart!.trendLineBreakthroughs = breakthroughs.filter(trendLine => {
      const identifier: string = `${trendLine.startIndex}:${trendLine.position}`;
      if (trendLineIdentifiers.has(identifier)) return false;
      trendLineIdentifiers.add(identifier);
      return true;
    });
  }
}

export function finalizeActiveBar(active: Bar, historical: Bar): Bar {
  return {
    ...active,
    times: historical.times,
    prices: historical.prices,
    volume: historical.volume,
    numberOfTrades: historical.numberOfTrades
  };
}

function fallbackSignalIdentifier(signal: BacktestSignal): string {
  const { price, ...identity } = signal;
  return JSON.stringify(identity);
}