import CandlestickPatternsController from '../../../patterns/candlestick-patterns';
import { Algorithm, BacktestData, BacktestSignal, Kline, KlineCandlestickPatterns, Signal } from '@shared';
import Base from '../../../../../base';

const BULLISH_PATTERNS: (keyof KlineCandlestickPatterns)[] = [
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

const BEARISH_PATTERNS: (keyof KlineCandlestickPatterns)[] = [
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

  public setSignals(klines: Kline[], algorithm: Algorithm, params: any): void {
    const minScore: number = Number(params.minScore);
    const takeProfit: number = 4;
    const stopLoss: number = 2;

    this.controller.addCandlestickPatterns(klines);

    klines.forEach((kline: Kline) => {
      const patterns: KlineCandlestickPatterns | undefined = kline.candlestickPatterns;
      if (!patterns) return;

      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;

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
