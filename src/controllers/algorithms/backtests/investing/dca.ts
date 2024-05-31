import { BacktestData, BacktestSignal, Kline, Signal } from '../../../../interfaces';
import Base from '../../../base';


export default class Dca extends Base {
  public setSignals(klines: Kline[], algorithm): Kline[] {
    klines.forEach((kline: Kline, i: number) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;

      if (i % 10 === 0) {
        signals.push({
          signal: Signal.Buy,
          size: 1,
          price: closePrice
        });
      }
    });

    return klines;
  }
}