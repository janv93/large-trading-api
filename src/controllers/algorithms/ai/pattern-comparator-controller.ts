import { BinanceKline } from '../../../interfaces';
import BaseController from '../../base-controller';

export default class PatternComparatorController extends BaseController {
  constructor() {
    super();
  }

  public setSignals(klines: Array<BinanceKline>, range: number): Array<BinanceKline> {
    const normalizedPatterns: Array<Array<number>> = this.normalizePatterns(klines, range);   // create array of patterns for comparing to one another

    normalizedPatterns.forEach((pattern, index) => {
      const similarity = this.comparePatterns(normalizedPatterns[normalizedPatterns.length - 1], pattern);

      if (similarity < 0.11 * range) {
        console.log(similarity);
        console.log(new Date(klines[index].times.open));
        console.log();
      }
    });

    return klines;
  }

  private comparePatterns(first: Array<number>, second: Array<number>): number {
    let similarity = 0;

    first.forEach((value, index) => {
      const diff = value - second[index];
      const absDiff = Math.abs(diff);
      similarity += absDiff;
    });

    return similarity;
  }

  /**
   * creates array of price patterns for each point in time for the next <range> klines
   */
  private normalizePatterns(klines: Array<BinanceKline>, range: number): Array<Array<number>> {
    const normalizedPatterns: Array<Array<number>> = [];

    for (let i = 0; i < klines.length - range; i++) {
      const pattern = klines.slice(i, i + 50);
      const normalizedPattern = this.normalizePattern(pattern);
      normalizedPatterns.push(normalizedPattern);
    }

    return normalizedPatterns;
  }

  /**
   * normalize price pattern array to have values between 0 and 1
   */
  private normalizePattern(klines: Array<BinanceKline>): Array<number> {
    const closes: Array<number> = klines.map(kline => kline.prices.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min;

    const normalizedPattern = closes.map(close => {
      return (close - min) / range;
    });

    return normalizedPattern;
  }

}