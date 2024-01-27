import { Kline, PivotPoint } from '../../../interfaces';

export default class Charting {
  public calcPivotPoints(klines: Kline[], leftLength: number, rightLength: number): Kline[] {
    klines.forEach((kline: Kline, i: number) => {
      const currentHigh = kline.prices.high;
      const currentLow = kline.prices.low;
  
      if (klines[i - leftLength] && klines[i + rightLength]) {
        const leftKlines = klines.slice(0, i);  // all leftious klines
        const rightKlines = klines.slice(i + 1); // all succeeding klines
  
        let leftLengthHigh: number = leftKlines.slice().reverse().findIndex((leftKline: Kline) => leftKline.prices.high > currentHigh);
        leftLengthHigh = leftLengthHigh === -1 ? Infinity : leftLengthHigh;
        let rightLengthHigh: number = rightKlines.findIndex((rightKline: Kline) => rightKline.prices.high > currentHigh);
        rightLengthHigh = rightLengthHigh === -1 ? Infinity : rightLengthHigh;
        const isHigh = leftLengthHigh >= leftLength && rightLengthHigh >= rightLength
  
        let leftLenthLow: number = leftKlines.slice().reverse().findIndex((leftKline: Kline) => leftKline.prices.low < currentLow);
        leftLenthLow = leftLenthLow === -1 ? Infinity : leftLenthLow;
        let rightLengthLow: number = rightKlines.findIndex((rightKline: Kline) => rightKline.prices.low < currentLow);
        rightLengthLow = rightLengthLow === -1 ? Infinity : rightLengthLow;
        const isLow = leftLenthLow >= leftLength && rightLengthLow >= rightLength;
  
        if (isHigh) {
          kline.metaData = { pivotPoint: PivotPoint.High };
        } else if (isLow) {
          kline.metaData = { pivotPoint: PivotPoint.Low };
        }
      }
    });

    return klines;
  }
}