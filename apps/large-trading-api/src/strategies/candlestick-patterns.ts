import CandlestickPatternsController from '../patterns/candlestick-patterns';
import { BacktestData, BacktestSignal, Bar, BarCandlestickPatterns, BearishCandlestickPattern, BullishCandlestickPattern, Signal, createSignal } from '@shared';
import Base from '../base';

export default class CandlestickPatterns extends Base {
  private controller = new CandlestickPatternsController();

  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const minScore: number = Number(params.minScore);
    const takeProfit: number = 4;
    const stopLoss: number = 2;
    const newPatterns: BarCandlestickPatterns = this.controller.stepCandlestickPatterns(bars);

    const bar: Bar = bars[bars.length - 1];
    if (!Object.keys(newPatterns).length) return;

    const backtest: BacktestData = bar.backtest!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    const bullishScore: number = Object.values(BullishCandlestickPattern).filter(pattern => newPatterns[pattern]).length;
    const bearishScore: number = Object.values(BearishCandlestickPattern).filter(pattern => newPatterns[pattern]).length;
    const netScore: number = bullishScore - bearishScore;

    if (netScore >= minScore) {
      signals.push(createSignal({ uniqueIdentifier: newPatterns, signal: Signal.Buy, size: Math.abs(netScore), price: closePrice, positionCloseTrigger: { tpSl: { takeProfit, stopLoss, asVolatilityFactor: true } } }));
    } else if (netScore <= -minScore) {
      signals.push(createSignal({ uniqueIdentifier: newPatterns, signal: Signal.Sell, size: Math.abs(netScore), price: closePrice, positionCloseTrigger: { tpSl: { takeProfit, stopLoss, asVolatilityFactor: true } } }));
    }
  }
}
