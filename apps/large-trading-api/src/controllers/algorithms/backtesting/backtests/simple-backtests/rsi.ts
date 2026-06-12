import Indicators from '../../../patterns/indicators';
import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../../../../../base';

export default class Rsi extends Base {
  private indicators = new Indicators();

  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const length = Number(params.length);
    this.indicators.addRsi(bars, length);
    const barsWithRsi = bars.filter(k => k.indicators?.rsi !== undefined);
    this.setSignalsOverBoughtOverSold(barsWithRsi, algorithm);

  }

  private setSignalsOverBoughtOverSold(bars: Bar[], algorithm: Algorithm): void {
    const rsiThresholdHigh = 60;
    const rsiThresholdLow = 40;

    let lastSignal: Signal;

    bars.forEach((bar) => {
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;
      const rsiValue = bar.indicators!.rsi!;

      if (lastSignal === Signal.Buy) {
        if (rsiValue > rsiThresholdHigh) {
          signals.push({
            signal: Signal.CloseAll,
            price: closePrice
          });

          signals.push({
            signal: Signal.Sell,
            size: 1,
            price: closePrice
          });

          lastSignal = Signal.Sell;
        }
      } else if (lastSignal === Signal.Sell) {
        if (rsiValue < rsiThresholdLow) {
          signals.push({
            signal: Signal.CloseAll,
            price: closePrice
          });

          signals.push({
            signal: Signal.Buy,
            size: 1,
            price: closePrice
          });

          lastSignal = Signal.Buy;
        }
      } else {
        if (rsiValue > rsiThresholdHigh) {
          signals.push({
            signal: Signal.CloseAll,
            price: closePrice
          });

          signals.push({
            signal: Signal.Sell,
            size: 1,
            price: closePrice
          });

          lastSignal = Signal.Sell;
        } else if (rsiValue < rsiThresholdLow) {
          signals.push({
            signal: Signal.CloseAll,
            price: closePrice
          });

          signals.push({
            signal: Signal.Buy,
            size: 1,
            price: closePrice
          });

          lastSignal = Signal.Buy;
        }
      }
    });

  }

}