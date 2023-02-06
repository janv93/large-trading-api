import { Kline } from '../../interfaces';
import BaseController from '../base-controller';

export default class FlashCrashController extends BaseController {
  public setSignals(klines: Kline[]): Kline[] {
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
            const isTpslReached = this.isTpslReached(this.buySignal, percentChangeSinceOpen, stopLoss, takeProfit);

            if (isTpslReached) {
              kline.signal = this.closeSignal;
              isOpen = false;
              isFlashCrash = false;
            }
          } else if (isStable) {    // 2. wait for stabilize
            kline.signal = this.buySignal;
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