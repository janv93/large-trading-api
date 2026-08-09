import { Bar, Signal } from '@shared';
import Base from '../base';

export default class Dca extends Base {
  public stepSetSignals(bars: Bar[], state: any, strategy: any, params: any): void {
    const i: number = bars.length - 1;
    if (i % 100 === 0) {
      const bar: Bar = bars[i];
      bar.backtests[strategy]!.signals.push({ signal: Signal.Buy, size: 1, price: bar.prices.close });
    }
  }
}