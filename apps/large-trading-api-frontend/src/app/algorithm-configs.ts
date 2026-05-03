import { Algorithm, AlgorithmConfig } from '../../../../libs/shared/src/lib/interfaces';

export const AlgorithmConfigs: Partial<Record<Algorithm, AlgorithmConfig>> = {
  [Algorithm.Momentum]: {
    single: {
      streak: 5
    }
  },
  [Algorithm.Macd]: {
    single: {
      fast: 12,
      slow: 26,
      signal: 9
    }
  },
  [Algorithm.Rsi]: {
    single: {
      length: 7
    }
  },
  [Algorithm.Ema]: {
    single: {
      periodOpen: 80,
      periodClose: 80
    }
  },
  [Algorithm.Bb]: {
    single: {
      period: 21
    }
  },
  [Algorithm.DeepTrend]: {
    single: {}
  },
  [Algorithm.Dca]: {
    single: {}
  },
  [Algorithm.MeanReversion]: {
    single: {
      threshold: 0.15,
      profitBasedTrailingStopLoss: 0.3,
      startStreak: 0
    },
    multi: {
      threshold: {
        min: 0.1,
        max: 0.2,
        step: 0.05
      },
      profitBasedTrailingStopLoss: {
        min: 0.1,
        max: 0.3,
        step: 0.05
      },
      startStreak: {
        min: 0,
        max: 0
      }
    }
  },
  [Algorithm.TrendLineBreakthrough]: {
    single: {
      percentProfit: 0.3
    }
  },
  [Algorithm.MarketStructure]: {
    single: {
      space: 5
    }
  },
  [Algorithm.Example]: {
    single: {
      size: 10
    }
  },
};