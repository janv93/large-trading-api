import { Kline, PivotPoint } from '../../../interfaces';

export default class Charting {
  public calcPivotPoints(klines: Kline[], range: number): Kline[] {
    klines.forEach((kline: Kline, i: number) => {
      const currentHigh = kline.prices.high;
      const currentLow = kline.prices.low;
  
      if (klines[i - range] && klines[i + range]) {
        const prevKlines = klines.slice(0, i);  // all previous klines
        const nextKlines = klines.slice(i + 1); // all succeeding klines
  
        const prevHighRange = prevKlines.slice().reverse().findIndex((prevKline: Kline) => prevKline.prices.high > currentHigh);
        const nextHighRange = nextKlines.findIndex((nextKline: Kline) => nextKline.prices.high > currentHigh);
        // how many elements minimum to the left and right have lower highs, -1 means all of them are lower
        const highRange = Math.min(prevHighRange === -1 ? Infinity : prevHighRange, nextHighRange === -1 ? Infinity : nextHighRange);
  
        const prevLowRange = prevKlines.slice().reverse().findIndex((prevKline: Kline) => prevKline.prices.low < currentLow);
        const nextLowRange = nextKlines.findIndex((nextKline: Kline) => nextKline.prices.low < currentLow);
        // how many elements minimum to the left and right have higher lows, -1 means all of them are higher
        const lowRange = Math.min(prevLowRange === -1 ? Infinity : prevLowRange, nextLowRange === -1 ? Infinity : nextLowRange);
  
        if (highRange >= range) {
          kline.metaData = { pivotPoint: PivotPoint.High };
        } else if (lowRange >= range) {
          kline.metaData = { pivotPoint: PivotPoint.Low };
        }
      }
    });

    return klines;
  }
}