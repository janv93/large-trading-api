import Indicators from '../../../technical-analysis/indicators';
import { Algorithm, BacktestData, BacktestSignal, Kline, Signal } from '../../../../interfaces';
import Base from '../../../../base';

export default class Bb extends Base {
  private indicators = new Indicators();

  public setSignals(klines: Kline[], algorithm: Algorithm, period: number): Kline[] {
    const bb = this.indicators.bb(klines, period);
    const klinesWithBb = klines.slice(-bb.length);

    const threshold = 0.003; // percent that the price has fall below lower band / rise above upper band for position to open
    const takeProfit = threshold * 4;
    const stopLoss = threshold * 1;

    klinesWithBb.forEach((kline: Kline, index: number) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;

      if (kline.prices.close < bb[index].bb.lower - bb[index].bb.lower * threshold) { // price crosses lower band
        signals.push({
          signal: Signal.Buy,
          size: 1,
          price: closePrice,
          positionCloseTrigger: {
            tpSl: {
              takeProfit,
              stopLoss
            }
          }
        });
      } else if (kline.prices.close > bb[index].bb.upper + bb[index].bb.upper * threshold) {  // price crosses upper band
        signals.push({
          signal: Signal.Sell,
          size: 1,
          price: closePrice,
          positionCloseTrigger: {
            tpSl: {
              takeProfit,
              stopLoss
            }
          }
        });
      }
    });

    return klines;
  }

}