import { Algorithm, AlgorithmConfig } from '../../../../libs/shared/src/lib/interfaces';

export const AlgorithmConfigs: Partial<Record<Algorithm, AlgorithmConfig>> = {
  [Algorithm.Momentum]: { single: { streak: 5 } },
  [Algorithm.Macd]: { single: { fast: 12, slow: 26, signal: 9 } },
  [Algorithm.Rsi]: { single: { length: 7 } },
  [Algorithm.Ema]: { single: { periodOpen: 80, periodClose: 80 } },
  [Algorithm.Bb]: { single: { period: 21 } },
  [Algorithm.DeepTrend]: { single: {} },
  [Algorithm.Dca]: { single: {} },
  [Algorithm.MeanReversion]: { single: { threshold: 0.15, profitBasedTrailingStopLoss: 0.3, startStreak: 0 } },
  [Algorithm.TrendLine]: { single: { percentProfit: 0.3 } },
  [Algorithm.MarketStructure]: { single: { space: 5 } },
  [Algorithm.Example]: { single: { size: 10 } },
};