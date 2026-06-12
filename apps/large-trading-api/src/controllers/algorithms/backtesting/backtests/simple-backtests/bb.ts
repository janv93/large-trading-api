import Indicators from '../../../patterns/indicators';
import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../../../../../base';

export default class Bb extends Base {
  private indicators = new Indicators();

  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const period = Number(params.period);
    this.indicators.addBb(bars, period);
    const barsWithBb = bars.filter(k => k.indicators?.bb !== undefined);

    const threshold = 0.003; // percent that the price has fall below lower band / rise above upper band for position to open
    const takeProfit = threshold * 4;
    const stopLoss = threshold * 1;

    barsWithBb.forEach((bar: Bar, index: number) => {
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;

      if (bar.prices.close < bar.indicators!.bb!.lower - bar.indicators!.bb!.lower * threshold) { // price crosses lower band
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
      } else if (bar.prices.close > bar.indicators!.bb!.upper + bar.indicators!.bb!.upper * threshold) {  // price crosses upper band
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