import { BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../../../../../base';

export default class Dca extends Base {
  public setSignals(bars: Bar[], algorithm, params: any): void {
    bars.forEach((bar: Bar, i: number) => {
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;

      if (i % (bars.length / 100) === 0) {
        signals.push({
          signal: Signal.Buy,
          size: 1,
          price: closePrice
        });
      }
    });

  }
}