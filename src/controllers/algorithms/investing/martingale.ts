import { Kline } from '../../../interfaces';
import Base from '../../base';


export default class Martingale extends Base {
  /**
   * 1. wait until drop of minDrop, then buy
   * 2. if further drops, buy exponentially more
   * 3. if increase from lowest drop sufficient, close position
   * 4. back to 1.
   */
  public setSignals(klines: Kline[], threshold: number, exitMultiplier: number): Kline[] {
    const initialClose = klines[0].prices.close;
    const minDrop = 0.4;
    let streak = 0;
    let peak = 0;
    let low = initialClose;
    let isOpen = false;

    for (const kline of klines) {
      const close = kline.prices.close;
      const diffFromLow = (close - low) / low;
      const diffFromPeak = (peak - close) / peak;

      // buy condition
      if (diffFromPeak > minDrop) {
        const excess = diffFromPeak - minDrop;
        const thresholdMultiple = excess / threshold;

        if (thresholdMultiple > streak) {
          kline.signal = this.buySignal;
          streak++;
          kline.amount = Math.pow(2, streak - 1); // start at 2^0
          isOpen = true;
          low = close;
        }

        continue;
      }

      // close condition
      if (isOpen && diffFromLow > threshold * exitMultiplier) {
        kline.signal = this.closeSignal;
        streak = 0;
        isOpen = false;
        peak = close;
        continue;
      }

      // new high
      if (!isOpen && close > peak) {
        peak = close;
      }
    }

    return klines;
  }
}