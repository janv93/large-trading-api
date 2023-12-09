import { Kline } from '../../../interfaces';
import Base from '../../base';

/**
 * The Dca class extends the Base class and implements a Dollar Cost Averaging strategy.
 */
export default class Dca extends Base {
  /**
   * Sets buy signals on every 10th kline element based on the specified algorithm.
   * @param klines - Array of Kline objects representing market data.
   * @param algorithm - The name of the algorithm to apply when setting signals.
   * @returns The modified array of Kline objects with applied signals.
   */
  public setSignals(klines: Kline[], algorithm): Kline[] { // Added comments for method
    klines.forEach((kline: Kline, i: number) => {
      if (i % 10 === 0) {
        kline.algorithms[algorithm].signal = this.buySignal;
      }
    });

    return klines;
  }
}
