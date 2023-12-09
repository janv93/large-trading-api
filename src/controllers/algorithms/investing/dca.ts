import { Kline } from '../../../interfaces';
import Base from '../../base';

/**
 * The Dca class extends the Base class and implements a Dollar-Cost Averaging strategy.
 */
export default class Dca extends Base {
  /**
   * Sets buy signals on every 10th kline element based on the specified algorithm.
   *
   * @param {Kline[]} klines - Array of kline objects representing market data.
   * @param {string} algorithm - Name of the algorithm used for setting signals.
   * @returns {Kline[]} The modified array with set signals.
   */
  public setSignals(klines: Kline[], algorithm: string): Kline[] {
    klines.forEach((kline: Kline, i: number) => {
      // On every 10th kline, set the signal property to the value of this.buySignal.
      if (i % 10 === 0) {
        kline.algorithms[algorithm].signal = this.buySignal;
      }
    });

    return klines;
  }
}
