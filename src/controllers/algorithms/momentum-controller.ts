import { BinanceKucoinKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class MomentumController extends BaseController {
  constructor() {
    super();
  }

  public setSignals(klines: Array<BinanceKucoinKline>, streak: number): Array<BinanceKucoinKline> {
    const colors: Array<number> = klines.map(kline => this.getKlineColor(kline));

    let positionOpen = false;
    let lastEntrySignal: string;
    let lastEntryIndex: number;

    klines.forEach((kline: any, index: number) => {
      if (!positionOpen) {
        const entry = this.isEntry(colors, index, streak);

        if (entry) {
          kline.signal = entry;
          positionOpen = true;
          lastEntrySignal = entry;
          lastEntryIndex = index;
        }
      } else {
        const close = this.isClose(klines, colors, index, streak, lastEntrySignal, lastEntryIndex);

        if (close) {
          kline.signal = this.closeSignal;
          positionOpen = false;
        }
      }
    });

    return klines;
  }

  private isEntry(colors: Array<number>, index: number, streak: number): string {
    if (streak > index) {
      return '';
    }

    const range = colors.slice(index - streak + 1, index + 1);
    const rangeGreen = range.every(kline => kline >= 0);
    const rangeRed = range.every(kline => kline <= 0);

    let signal = rangeGreen ? this.closeBuySignal : rangeRed ? this.closeSellSignal : ''
    // invert the signal
    signal = this.invertSignal(signal);

    return signal;
  }

  private isClose(klines: Array<BinanceKucoinKline>, colors: Array<any>, index: number, streak: number, lastEntrySignal: string, lastEntryIndex: number): boolean {
    const closePriceAtLastEntry = klines[lastEntryIndex].prices.close;
    const currentPrice = klines[index].prices.close;

    const priceDiff = currentPrice - closePriceAtLastEntry;
    const priceDiffPercent = priceDiff / closePriceAtLastEntry;
    const slRate = 0.003;
    const tpRate = slRate * 2;

    return this.isTpslReached(lastEntrySignal, priceDiffPercent, slRate, tpRate);
  }
}