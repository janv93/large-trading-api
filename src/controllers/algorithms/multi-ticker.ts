import { Kline } from '../../interfaces';
import Base from '../base';
import Ema from './ema';
import Backtest from './backtest';

export default class MultiTicker extends Base {
  private ema = new Ema();
  private backtest = new Backtest();

  public setSignals(klines: Kline[]): any {
    const klinesWithSignals = this.ema.setSignals(klines, 80, 80);
    const klinesWithBacktest = this.backtest.calcBacktestPerformance(klinesWithSignals, 0, true);
    console.log(klines[0].symbol, klinesWithBacktest.at(-1)?.percentProfit);
    return;
    // all time high 20% above old -> scale into short
    // only set signal if n klines before now
    // then: only set signal if rsi high
  }
}