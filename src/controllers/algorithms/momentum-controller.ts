import Utilities from '../../utilities/utilities';

export default class PivotReversalController extends Utilities {
  constructor() {
    super();
  }

  public setSignals(klines: Array<any>, streak: number): Array<any> {
    const colors = klines.map(kline => this.getKlineColor(kline));

    let positionOpen = false;
    let lastEntrySignal: string;
    let lastEntryIndex: number;

    klines.forEach((kline: any, index: number) => {
      if (!positionOpen) {
        const entry = this.isEntry(colors, index, streak);

        if (entry) {
          kline.push(entry);
          positionOpen = true;
          lastEntrySignal = entry;
          lastEntryIndex = index;
        }
      } else {
        const close = this.isClose(klines, colors, index, streak, lastEntrySignal, lastEntryIndex);

        if (close) {
          kline.push('CLOSE');
          positionOpen = false;
        }
      }
    });

    return klines;
  }

  private isEntry(colors: Array<any>, index: number, streak: number): string {
    if (streak > index) {
      return '';
    }

    const range = colors.slice(index - streak + 1, index + 1);
    const rangeGreen = range.every(kline => kline >= 0);
    const rangeRed = range.every(kline => kline <= 0);

    return rangeGreen ? 'BUY' : rangeRed ? 'SELL' : '';
  }

  private isClose(klines: Array<any>, colors: Array<any>, index: number, streak: number, lastEntrySignal: string, lastEntryIndex: number): boolean {
    const range = klines.slice(lastEntryIndex + 1, index + 1);
    const closePriceAtLastEntry = klines[lastEntryIndex][4];

    // condition 1: opposite signal occurs since last signal, trend reversal
    let conditionOppositeTrend = false;

    if (range.length >= streak) {
      const isOppositeEntry = this.isEntry(colors, index, streak);

      conditionOppositeTrend = isOppositeEntry ? (isOppositeEntry !== lastEntrySignal ? true : false) : false;
    }
    

    // condition 2: close price dropped certain percentage below highest close since streak

    // vice versa for SELL signal


    return conditionOppositeTrend;
  }
}