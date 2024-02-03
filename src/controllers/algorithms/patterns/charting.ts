import { Kline, PivotPoint, PivotPointDirection } from '../../../interfaces';

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
          kline.chartData = kline.chartData || {};
          kline.chartData.pivotPoints = kline.chartData.pivotPoints || [];

          kline.chartData.pivotPoints.push({
            left: leftLengthHigh,
            right: rightLengthHigh,
            direction: PivotPointDirection.High
          });
        } else if (isLow) {
          if (!kline.chartData) {
            kline.chartData = {};
          }

          if (!kline.chartData.pivotPoints) {
            kline.chartData.pivotPoints = [];
          }

          const pp: PivotPoint = {
            left: leftLenthLow,
            right: rightLengthLow,
            direction: PivotPointDirection.Low
          };

          kline.chartData.pivotPoints.push(pp);
        }
      }
    });

    return klines;
  }
}