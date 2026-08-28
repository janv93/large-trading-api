import { stepBb } from '../patterns/indicators/bb';
import { BacktestData, BacktestSignal, Bar, BollingerBand, Signal, createSignal } from '@shared';
import Base from '../base';

export default class Bb extends Base {
  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const period = Number(params.period);
    stepBb(bars, period);

    const bar: Bar = bars[bars.length - 1];
    if (!bar.indicators?.bb) return;

    const { bb } = bar.indicators;
    const threshold = 0.003;
    const takeProfit = threshold * 4;
    const stopLoss = threshold * 1;
    const backtest: BacktestData = bar.backtest!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    if (closePrice < bb.lower - bb.lower * threshold) {
      signals.push(createSignal({ uniqueIdentifier: { period, band: BollingerBand.Lower }, signal: Signal.Buy, size: 1, price: closePrice, positionCloseTrigger: { tpSl: { takeProfit, stopLoss } } }));
    } else if (closePrice > bb.upper + bb.upper * threshold) {
      signals.push(createSignal({ uniqueIdentifier: { period, band: BollingerBand.Upper }, signal: Signal.Sell, size: 1, price: closePrice, positionCloseTrigger: { tpSl: { takeProfit, stopLoss } } }));
    }
  }

}