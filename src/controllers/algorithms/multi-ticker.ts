import { Kline } from '../../interfaces';
import Base from '../base';
import Backtest from './backtest';
import Ema from './ema';
import Martingale from './investing/martingale';

export default class MultiTicker extends Base {
  private ema = new Ema();
  private backtest = new Backtest();
  private martingale = new Martingale();

  public setSignals(klines: Kline[]): any {
    const klinesWithSignals = this.martingale.setSignals(klines, 0.1);
    const klinesWithBacktest = this.backtest.calcBacktestPerformance(klinesWithSignals, 0, true);
    console.log(klines.length, klines[0].symbol, klinesWithBacktest.at(-1)?.percentProfit);
    return;
    // todo algo: all time high 20% above old -> scale into short
    // only set signal if n klines before now
    // then: only set signal if rsi high
  }
}