import { BacktestData, BacktestSignal, Bar, Signal, createSignal } from '@shared';
import Base from '../base';
import { stepRsiDivergence } from '../patterns/indicators/rsi-divergence';
import TrendLineController from '../patterns/trend-line';

export default class RsiDivergence extends Base {
  private trendLineController = new TrendLineController();

  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const minLength: number = Number(params.minLength ?? 50);
    const maxLength: number = Number(params.maxLength ?? 200);
    const minStrength: number = Number(params.minStrength ?? 0.5);
    const stopLoss: number = Number(params.stopLoss ?? 0.02);
    state.trendLines ??= {};

    this.trendLineController.stepTrendLines(bars, state.trendLines, minLength, maxLength, false, false);
    const rsiDiv = stepRsiDivergence(bars, state.trendLines, minStrength);

    const bar: Bar = bars[bars.length - 1];
    if (!rsiDiv) return;

    const backtest: BacktestData = bar.backtest!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;
    const { regular, hidden } = rsiDiv;

    const strength: number = (regular ?? 0) + (hidden ?? 0);

    if (strength > 0) {
      signals.push(createSignal({ uniqueIdentifier: rsiDiv.originTrendLines, signal: Signal.Buy, size: strength, price: closePrice, positionCloseTrigger: { tSl: { stopLoss } } }));
    } else if (strength < 0) {
      signals.push(createSignal({ uniqueIdentifier: rsiDiv.originTrendLines, signal: Signal.Sell, size: Math.abs(strength), price: closePrice, positionCloseTrigger: { tSl: { stopLoss } } }));
    }
  }
}
