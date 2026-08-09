import { Strategy, StrategyConfig } from '../../../../libs/shared/src/lib/interfaces';

export const StrategyConfigs: Partial<Record<Strategy, StrategyConfig>> = {
  [Strategy.Momentum]: {
    default: {
      streak: 5
    },
    autoParams: {
      streak: { min: 3, max: 10, step: 1 }
    }
  },
  [Strategy.Macd]: {
    default: {
      fast: 12,
      slow: 26,
      signal: 9
    },
    autoParams: {
      fast: { min: 8, max: 16, step: 2 },
      slow: { min: 20, max: 30, step: 2 },
      signal: { min: 7, max: 11, step: 1 }
    }
  },
  [Strategy.Rsi]: {
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
  [Strategy.Ema]: {
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
  [Strategy.Bb]: {
    default: {
      period: 21
    },
    autoParams: {
      period: { min: 10, max: 30, step: 5 }
    }
  },
  [Strategy.Dca]: {
    default: {},
    autoParams: {}
  },
  [Strategy.MeanReversion]: {
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
  [Strategy.TrendLineBreakthrough]: {
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
  [Strategy.MarketStructure]: {
    default: {
      space: 5
    },
    autoParams: {
      space: { min: 3, max: 10, step: 1 }
    }
  },
  [Strategy.RsiDivergence]: {
    default: {
    },
    autoParams: {
    }
  },
  [Strategy.Example]: {
    default: {
      size: 10
    },
    autoParams: {
      size: { min: 5, max: 20, step: 5 }
    }
  },
  [Strategy.CandlestickPatterns]: {
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