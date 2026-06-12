import CandlestickPatternsController from '../../../patterns/candlestick-patterns';
import { Algorithm, BacktestData, BacktestSignal, Bar, BarCandlestickPatterns, Signal } from '@shared';
import Base from '../../../../../base';

const BULLISH_PATTERNS: (keyof BarCandlestickPatterns)[] = [
  'hammer',
  'invertedHammer',
  'bullishMarubozu',
  'bullishEngulfing',
  'bullishHarami',
  'piercingLine',
  'tweezersBottom',
  'morningStar',
  'threeWhiteSoldiers',
];

const BEARISH_PATTERNS: (keyof BarCandlestickPatterns)[] = [
  'hangingMan',
  'shootingStar',
  'bearishMarubozu',
  'bearishEngulfing',
  'bearishHarami',
  'darkCloudCover',
  'tweezersTop',
  'eveningStar',
  'threeBlackCrows',
];

export default class CandlestickPatterns extends Base {
  private controller = new CandlestickPatternsController();

  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const minScore: number = Number(params.minScore);
    const takeProfit: number = 4;
    const stopLoss: number = 2;

    this.controller.addCandlestickPatterns(bars);

    bars.forEach((bar: Bar) => {
      const patterns: BarCandlestickPatterns | undefined = bar.candlestickPatterns;
      if (!patterns) return;

      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;

      const bullishScore: number = BULLISH_PATTERNS.filter(p => patterns[p]).length;
      const bearishScore: number = BEARISH_PATTERNS.filter(p => patterns[p]).length;
      const netScore: number = bullishScore - bearishScore;

      if (netScore >= minScore) {
        signals.push({
          signal: Signal.Buy,
          size: 1,
          price: closePrice,
          positionCloseTrigger: {
            tpSl: { takeProfit, stopLoss, asVolatilityFactor: true },
          },
        });
      } else if (netScore <= -minScore) {
        signals.push({
          signal: Signal.Sell,
          size: 1,
          price: closePrice,
          positionCloseTrigger: {
            tpSl: { takeProfit, stopLoss, asVolatilityFactor: true },
          },
        });
      }
    });
  }
}
