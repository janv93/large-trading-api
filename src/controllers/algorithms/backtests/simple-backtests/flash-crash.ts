import { Kline, Signal } from '../../../../interfaces';
import Base from '../../../base';

export default class FlashCrash extends Base {
  public setSignals(klines: Kline[], algorithm: string): Kline[] {
    // WIP: react to rapid price decrease in short time interval
    // idea: use martingale at resistances / max % drop

    let isOpen = false;
    let isFlashCrash = false;
    let openPrice;
    const lookback = 5;
    const threshold = 2 / 100;

    klines.forEach((kline, index) => {
      if (index > lookback) {
        const lookBackClose = klines[index - lookback].prices.close;
        const close = kline.prices.close;
        const lookBackPercentChange = this.percentage(lookBackClose, close);

        if (isFlashCrash) {
          const stableInterval = 3;
          const stableTreshold = 0.3 / 100;

          const stableLookBackClose = klines[index - stableInterval].prices.close;
          const stablePercentChange = Math.abs(this.percentage(stableLookBackClose, close));
          const isStable = stablePercentChange < stableTreshold;

          if (isOpen) {     // 3. exit on tp or sl
            const percentChangeSinceOpen = this.percentage(openPrice, close);
            const takeProfit = threshold * 3 / 4
            const stopLoss = threshold / 3;
            const isTpSlReached = this.isTpSlReached(Signal.Buy, percentChangeSinceOpen, stopLoss, takeProfit);

            if (isTpSlReached) {
              kline.algorithms[algorithm].signal = Signal.Close;
              isOpen = false;
              isFlashCrash = false;
            }
          } else if (isStable) {    // 2. wait for stabilize
            kline.algorithms[algorithm].signal = Signal.Buy;
            openPrice = close;
            isOpen = true;
          }
        } else if (lookBackPercentChange < -threshold) {    // 1. enter flash crash
          isFlashCrash = true;
        }
      }
    });

    return klines;
  }
}