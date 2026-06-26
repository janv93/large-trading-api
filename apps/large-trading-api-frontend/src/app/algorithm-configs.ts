import { Algorithm, AlgorithmConfig } from '../../../../libs/shared/src/lib/interfaces';

export const AlgorithmConfigs: Partial<Record<Algorithm, AlgorithmConfig>> = {
  [Algorithm.Momentum]: {
    default: {
      streak: 5
    }
  },
  [Algorithm.Macd]: {
    default: {
      fast: 12,
      slow: 26,
      signal: 9
    }
  },
  [Algorithm.Rsi]: {
    default: {
      length: 7
    },
    autoParams: {
      length: {
        min: 5,
        max: 15,
        step: 5
      }
    }
  },
  [Algorithm.Ema]: {
    default: {
      periodOpen: 80,
      periodClose: 80
    },
    autoParams: {
      periodOpen: {
        min: 50,
        max: 200,
        step: 10
      },
      periodClose: {
        min: 50,
        max: 200,
        step: 10
      }
    }
  },
  [Algorithm.Bb]: {
    default: {
      period: 21
    }
  },
  [Algorithm.Dca]: {
    default: {}
  },
  [Algorithm.MeanReversion]: {
    default: {
      threshold: 0.15,
      profitBasedTrailingStopLoss: 0.3,
      startStreak: 0
    },
    autoParams: {
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
    default: {
      percentOfProfit: 0.5
    },
    autoParams: {
      percentOfProfit: {
        min: 0.1,
        max: 0.7,
        step: 0.1
      }
    }
  },
  [Algorithm.MarketStructure]: {
    default: {
      space: 5
    }
  },
  [Algorithm.RsiDivergence]: {
    default: {
    },
    autoParams: {
    }
  },
  [Algorithm.Example]: {
    default: {
      size: 10
    }
  },
  [Algorithm.CandlestickPatterns]: {
    default: {
      minScore: 3
    },
    autoParams: {
      minScore: {
        min: 2,
        max: 3,
        step: 1
      }
    }
  },
};