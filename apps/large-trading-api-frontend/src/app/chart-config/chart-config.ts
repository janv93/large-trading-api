import { Exchange, ExchangeSymbol, Strategy, Timeframe } from '@shared';

export interface StrategySelection {
  strategy: Strategy;
  autoParams: boolean;
}

export interface ChartConfig {
  timeframe: Timeframe;
  times: number;
  commission: number;
  mainStrategy: StrategySelection;
  comparisonStrategy: StrategySelection | null;
  symbols: ExchangeSymbol[];
  autoSymbols: boolean;
  rank: number;
}

const STORAGE_KEY = 'large-trading.chartConfig.v1';

const DEFAULT_CONFIG: ChartConfig = {
  timeframe: Timeframe._1Hour,
  times: 1,
  commission: 0.0004,
  mainStrategy: { strategy: Strategy.Example, autoParams: false },
  comparisonStrategy: null,
  symbols: [{ exchange: Exchange.Binance, symbol: 'BTCUSDT' }],
  autoSymbols: false,
  rank: 15
};

export function copyChartConfig(config: ChartConfig): ChartConfig {
  return structuredClone(config);
}

export function normalizeChartConfig(value: Partial<ChartConfig> | null | undefined): ChartConfig {
  const timeframes = Object.values(Timeframe);
  const strategies = Object.values(Strategy);
  const exchanges = Object.values(Exchange);
  const symbols = Array.isArray(value?.symbols)
    ? value.symbols
      .filter(item => exchanges.includes(item?.exchange) && typeof item?.symbol === 'string' && item.symbol.trim())
      .map(item => ({ exchange: item.exchange, symbol: item.symbol.trim().toUpperCase() }))
    : DEFAULT_CONFIG.symbols;
  const mainStrategy = value?.mainStrategy;
  const comparisonStrategy = value?.comparisonStrategy;

  return {
    timeframe: timeframes.includes(value?.timeframe as Timeframe) ? value!.timeframe! : DEFAULT_CONFIG.timeframe,
    times: positiveInteger(value?.times, DEFAULT_CONFIG.times),
    commission: nonNegativeNumber(value?.commission, DEFAULT_CONFIG.commission),
    mainStrategy: {
      strategy: strategies.includes(mainStrategy?.strategy as Strategy) ? mainStrategy!.strategy : DEFAULT_CONFIG.mainStrategy.strategy,
      autoParams: Boolean(mainStrategy?.autoParams)
    },
    comparisonStrategy: comparisonStrategy && strategies.includes(comparisonStrategy.strategy as Strategy)
      ? { strategy: comparisonStrategy.strategy, autoParams: Boolean(comparisonStrategy.autoParams) }
      : null,
    symbols: symbols.length ? symbols : copyChartConfig(DEFAULT_CONFIG).symbols,
    autoSymbols: Boolean(value?.autoSymbols),
    rank: positiveInteger(value?.rank, DEFAULT_CONFIG.rank)
  };
}

export function loadChartConfig(): ChartConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeChartConfig(JSON.parse(stored)) : copyChartConfig(DEFAULT_CONFIG);
  } catch {
    return copyChartConfig(DEFAULT_CONFIG);
  }
}

export function saveChartConfig(config: ChartConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // The current configuration remains usable when browser storage is unavailable.
  }
}

export function getStrategies(config: ChartConfig): StrategySelection[] {
  return [config.mainStrategy, ...(config.comparisonStrategy ? [config.comparisonStrategy] : [])];
}

export function isMultiConfig(config: ChartConfig): boolean {
  return config.autoSymbols || config.symbols.length !== 1;
}

function positiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}