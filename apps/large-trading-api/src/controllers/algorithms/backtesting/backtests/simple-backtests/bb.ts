import Indicators from '../../../patterns/indicators';
import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../../../../../base';

export default class Bb extends Base {
  private indicators = new Indicators();

  public stepSetSignals(bars: Bar[], state: any, algorithm: Algorithm, params: any): void {
    const period = Number(params.period);
    this.indicators.stepBb(bars, period);

    const bar: Bar = bars[bars.length - 1];
    if (!bar.indicators?.bb) return;

    const { bb } = bar.indicators;
    const threshold = 0.003;
    const takeProfit = threshold * 4;
    const stopLoss = threshold * 1;
    const backtest: BacktestData = bar.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    if (closePrice < bb.lower - bb.lower * threshold) {
      signals.push({ signal: Signal.Buy, size: 1, price: closePrice, positionCloseTrigger: { tpSl: { takeProfit, stopLoss } } });
    } else if (closePrice > bb.upper + bb.upper * threshold) {
      signals.push({ signal: Signal.Sell, size: 1, price: closePrice, positionCloseTrigger: { tpSl: { takeProfit, stopLoss } } });
    }
  }

}