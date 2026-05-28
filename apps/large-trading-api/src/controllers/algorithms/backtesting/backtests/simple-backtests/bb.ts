import Indicators from '../../../patterns/indicators';
import { Algorithm, BacktestData, BacktestSignal, Kline, Signal } from '@shared';
import Base from '../../../../../base';

export default class Bb extends Base {
  private indicators = new Indicators();

  public setSignals(klines: Kline[], algorithm: Algorithm, params: any): void {
    const period = Number(params.period);
    this.indicators.addBb(klines, period);
    const klinesWithBb = klines.filter(k => k.indicators?.bb !== undefined);

    const threshold = 0.003; // percent that the price has fall below lower band / rise above upper band for position to open
    const takeProfit = threshold * 4;
    const stopLoss = threshold * 1;

    klinesWithBb.forEach((kline: Kline, index: number) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;

      if (kline.prices.close < kline.indicators!.bb!.lower - kline.indicators!.bb!.lower * threshold) { // price crosses lower band
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
      } else if (kline.prices.close > kline.indicators!.bb!.upper + kline.indicators!.bb!.upper * threshold) {  // price crosses upper band
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

  }

}