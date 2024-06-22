import Indicators from '../../../technical-analysis/indicators';
import { Algorithm, BacktestData, BacktestSignal, Kline, Signal } from '../../../../interfaces';
import Base from '../../../../base';

export default class Rsi extends Base {
  private indicators = new Indicators();

  public setSignals(klines: Kline[], algorithm: Algorithm, length: number): Kline[] {
    const rsi = this.indicators.rsi(klines, length);
    const klinesWithRsi = klines.slice(-rsi.length);
    this.setSignalsOverBoughtOverSold(klinesWithRsi, algorithm, rsi);

    return klines;
  }

  private setSignalsOverBoughtOverSold(klines: Kline[], algorithm: Algorithm, rsi: any[]): Kline[] {
    const rsiThresholdHigh = 60;
    const rsiThresholdLow = 40;

    let lastSignal: Signal;

    klines.forEach((kline, index) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;
      const rsiValue = rsi[index].rsi;

      if (lastSignal === Signal.Buy) {
        if (rsiValue > rsiThresholdHigh) {
          signals.push({
            signal: Signal.Close,
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
            signal: Signal.Close,
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
            signal: Signal.Close,
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
            signal: Signal.Close,
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

    return klines;
  }

}