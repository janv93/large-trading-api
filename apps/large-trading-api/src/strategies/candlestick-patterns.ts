import { BacktestSignal, Bar, BarCandlestickPatterns, BearishCandlestickPattern, BullishCandlestickPattern, Signal } from '@shared';
import Base from '../base';
import CandlestickPatternsController from '../patterns/candlestick-patterns';

export default class CandlestickPatterns extends Base {
  private controller = new CandlestickPatternsController();

  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const minScore: number = Number(params.minScore);
    const takeProfit: number = 4;
    const stopLoss: number = 2;
    state.barDone = true; // the decision uses only completed candles and this bar's open, so later ticks cannot change it
    this.controller.stepCandlestickPatterns(bars);
    const patterns: BarCandlestickPatterns | undefined = bars.at(-2)?.candlestickPatterns;
    if (!patterns) return;

    const bar: Bar = bars[bars.length - 1];
    const signals: BacktestSignal[] = bar.backtest.signals;
    const openPrice: number = bar.prices.open;

    const bullishScore: number = Object.values(BullishCandlestickPattern).filter((pattern) => patterns[pattern]).length;
    const bearishScore: number = Object.values(BearishCandlestickPattern).filter((pattern) => patterns[pattern]).length;
    const netScore: number = bullishScore - bearishScore;

    if (netScore >= minScore) {
      signals.push({
        signal: Signal.Buy,
        size: Math.abs(netScore),
        price: openPrice,
        positionCloseTrigger: { tpSl: { takeProfit, stopLoss, asVolatilityFactor: true } },
      });
    } else if (netScore <= -minScore) {
      signals.push({
        signal: Signal.Sell,
        size: Math.abs(netScore),
        price: openPrice,
        positionCloseTrigger: { tpSl: { takeProfit, stopLoss, asVolatilityFactor: true } },
      });
    }
  }
}
