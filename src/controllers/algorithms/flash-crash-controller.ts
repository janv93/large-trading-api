import { BinanceKucoinKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class FlashCrashController extends BaseController {
  constructor() {
    super();
  }

  public setSignals(klines: Array<BinanceKucoinKline>): Array<BinanceKucoinKline> {
    // WIP: react to rapid price decrease in short time interval
    // idea: use martingale at resistances / max % drop

    let isOpen = false;
    let isFlashCrash = false;
    let openPrice;
    const lookback = 8;
    const threshold = 1 / 100; // 1%

    klines.forEach((kline, index) => {
      if (index > lookback) {
        const lookBackClose = klines[index - lookback].prices.close;
        const close = kline.prices.close;
        const lookBackPercentChange = this.percentage(lookBackClose, close);

        if (isFlashCrash) {
          const stableInterval = 2;
          const stableTreshold = 0.1 / 100;

          const stableLookBackClose = klines[index - stableInterval].prices.close;
          const stablePercentChange = Math.abs(this.percentage(stableLookBackClose, close));
          const isStable = stablePercentChange < stableTreshold;

          if (isOpen) {     // 3. exit on tp or sl
            const percentChangeSinceOpen = this.percentage(openPrice, close);
            const isTpslReached = this.isTpslReached(this.buySignal, percentChangeSinceOpen, 0.1 / 100, 0.3 / 100);

            if (isTpslReached) {
              kline.signal = this.closeSignal;
              isOpen = false;
            }
          } else if (isStable) {    // 2. wait for stabilize
            kline.signal = this.buySignal;
            isFlashCrash = false;
            isOpen = true;
            openPrice = close
          }
        } else if (lookBackPercentChange < -threshold) {    // 1. enter flash crash
          isFlashCrash = true;
        }
      }
    });

    return klines;
  }
}