import { KlineCandlestickPatterns, Kline, KlinePrices } from '@shared';
import Base from '../../../base';

export default class CandlestickPatternsController extends Base {
  constructor() {
    super();
  }

  public addCandlestickPatterns(klines: Kline[]): void {
    for (let i = 0; i < klines.length; i++) {
      const patterns: KlineCandlestickPatterns = {};

      this.detectSingleCandle(klines[i].prices, patterns);

      if (i >= 1) {
        this.detectTwoCandle(klines[i - 1].prices, klines[i].prices, patterns);
      }

      if (i >= 2) {
        this.detectThreeCandle(klines[i - 2].prices, klines[i - 1].prices, klines[i].prices, patterns);
      }

      if (Object.keys(patterns).length > 0) {
        klines[i].candlestickPatterns = patterns;
      }
    }
  }

  private detectSingleCandle(p: KlinePrices, patterns: KlineCandlestickPatterns): void {
    const body: number = Math.abs(p.close - p.open);
    const range: number = p.high - p.low;

    if (range === 0) return;

    const upperShadow: number = p.high - Math.max(p.open, p.close);
    const lowerShadow: number = Math.min(p.open, p.close) - p.low;
    const isBullish: boolean = p.close >= p.open;
    const bodyRatio: number = body / range;

    // Doji: body <= 5% of range
    if (bodyRatio <= 0.05) {
      patterns.doji = true;
    }

    // Hammer / Hanging Man: small body at top, long lower shadow (>= 2x body), tiny upper shadow (<= 10% of range)
    if (body > 0 && lowerShadow >= 2 * body && upperShadow <= 0.1 * range) {
      if (isBullish) {
        patterns.hammer = true;
      } else {
        patterns.hangingMan = true;
      }
    }

    // Inverted Hammer / Shooting Star: small body at bottom, long upper shadow (>= 2x body), tiny lower shadow (<= 10% of range)
    if (body > 0 && upperShadow >= 2 * body && lowerShadow <= 0.1 * range) {
      if (isBullish) {
        patterns.invertedHammer = true;
      } else {
        patterns.shootingStar = true;
      }
    }

    // Marubozu: body >= 90% of range (almost no shadows)
    if (bodyRatio >= 0.9) {
      if (isBullish) {
        patterns.bullishMarubozu = true;
      } else {
        patterns.bearishMarubozu = true;
      }
    }

    // Spinning Top: body 10–40% of range, both shadows present and roughly equal
    if (bodyRatio >= 0.1 && bodyRatio <= 0.4 && upperShadow > 0 && lowerShadow > 0) {
      const shadowRatio: number = Math.min(upperShadow, lowerShadow) / Math.max(upperShadow, lowerShadow);
      if (shadowRatio >= 0.5) {
        patterns.spinningTop = true;
      }
    }
  }

  private detectTwoCandle(prev: KlinePrices, curr: KlinePrices, patterns: KlineCandlestickPatterns): void {
    const prevBullish: boolean = prev.close >= prev.open;
    const currBullish: boolean = curr.close >= curr.open;
    const prevBody: number = Math.abs(prev.close - prev.open);
    const currBody: number = Math.abs(curr.close - curr.open);

    // Bullish Engulfing: prev bearish, curr bullish body fully engulfs prev body
    if (!prevBullish && currBullish && curr.open < prev.close && curr.close > prev.open) {
      patterns.bullishEngulfing = true;
    }

    // Bearish Engulfing: prev bullish, curr bearish body fully engulfs prev body
    if (prevBullish && !currBullish && curr.open > prev.close && curr.close < prev.open) {
      patterns.bearishEngulfing = true;
    }

    // Bullish Harami: prev bearish large, curr small bullish body contained inside prev body
    if (!prevBullish && currBullish && prevBody > 0 && currBody < prevBody * 0.5 &&
      curr.open > prev.close && curr.close < prev.open) {
      patterns.bullishHarami = true;
    }

    // Bearish Harami: prev bullish large, curr small bearish body contained inside prev body
    if (prevBullish && !currBullish && prevBody > 0 && currBody < prevBody * 0.5 &&
      curr.open < prev.close && curr.close > prev.open) {
      patterns.bearishHarami = true;
    }

    // Piercing Line: prev bearish, curr bullish opens below prev low, closes above 50% into prev body
    if (!prevBullish && currBullish && curr.open < prev.low && prevBody > 0) {
      const midpoint: number = prev.open - prevBody * 0.5;
      if (curr.close > midpoint && curr.close < prev.open) {
        patterns.piercingLine = true;
      }
    }

    // Dark Cloud Cover: prev bullish, curr bearish opens above prev high, closes below 50% into prev body
    if (prevBullish && !currBullish && curr.open > prev.high && prevBody > 0) {
      const midpoint: number = prev.open + prevBody * 0.5;
      if (curr.close < midpoint && curr.close > prev.open) {
        patterns.darkCloudCover = true;
      }
    }

    // Tweezer Top: prev bullish, curr bearish, both share approximately the same high
    if (prevBullish && !currBullish && prev.high > 0 && Math.abs(prev.high - curr.high) / prev.high < 0.001) {
      patterns.tweezersTop = true;
    }

    // Tweezer Bottom: prev bearish, curr bullish, both share approximately the same low
    if (!prevBullish && currBullish && prev.low > 0 && Math.abs(prev.low - curr.low) / prev.low < 0.001) {
      patterns.tweezersBottom = true;
    }
  }

  private detectThreeCandle(first: KlinePrices, mid: KlinePrices, last: KlinePrices, patterns: KlineCandlestickPatterns): void {
    const firstBullish: boolean = first.close >= first.open;
    const midBullish: boolean = mid.close >= mid.open;
    const lastBullish: boolean = last.close >= last.open;
    const firstBody: number = Math.abs(first.close - first.open);
    const midBody: number = Math.abs(mid.close - mid.open);

    // Morning Star: large bearish → small middle candle opens below first close → large bullish closes > 50% into first
    if (!firstBullish && midBody < firstBody * 0.5 && lastBullish && mid.open < first.close) {
      const midpoint: number = first.open - firstBody * 0.5;
      if (last.close > midpoint) {
        patterns.morningStar = true;
      }
    }

    // Evening Star: large bullish → small middle candle opens above first close → large bearish closes < 50% into first
    if (firstBullish && midBody < firstBody * 0.5 && !lastBullish && mid.open > first.close) {
      const midpoint: number = first.open + firstBody * 0.5;
      if (last.close < midpoint) {
        patterns.eveningStar = true;
      }
    }

    // Three White Soldiers: three consecutive bullish candles, each opening within prior body and closing higher
    if (firstBullish && midBullish && lastBullish &&
      mid.open > first.open && mid.open < first.close && mid.close > first.close &&
      last.open > mid.open && last.open < mid.close && last.close > mid.close) {
      patterns.threeWhiteSoldiers = true;
    }

    // Three Black Crows: three consecutive bearish candles, each opening within prior body and closing lower
    if (!firstBullish && !midBullish && !lastBullish &&
      mid.open < first.open && mid.open > first.close && mid.close < first.close &&
      last.open < mid.open && last.open > mid.close && last.close < mid.close) {
      patterns.threeBlackCrows = true;
    }
  }
}
