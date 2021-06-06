import Utilities from '../../utilities/utilities';

export default class PivotReversalController extends Utilities {
  constructor() {
    super();
  }

  public setSignals(klines: Array<any>, streak: number): Array<any> {
    const colors = klines.map(kline => this.getKlineColor(kline));

    let positionOpen = false;

    klines.forEach((kline: any, index: number) => {
      if (!positionOpen) {
        const entry = this.isEntry(colors, index, streak);

        if (entry) {
          kline.push(entry);
          positionOpen = true;
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

  private isClose(klines: Array<any>, index: number, streak: number) {
    // condition 1: close price did not increase in <streak> number of klines

    // condition 2: close price dropped certain percentage below highest close since streak

    // vice versa for SELL signal
  }
}