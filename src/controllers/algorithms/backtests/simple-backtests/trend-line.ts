import { Algorithm, BacktestData, Kline, Position, Signal, TrendLine } from '../../../../interfaces';
import Base from '../../../base';
import Charting from '../../patterns/charting';
import { LinearFunction } from '../../patterns/linear-function';

export default class TrendLineBreakthrough extends Base {
  private charting = new Charting();

  public setSignals(klines: Kline[], algorithm: Algorithm): Kline[] {
    this.charting.addPivotPoints(klines, 10, 10);
    this.charting.addTrendLinesFromPivotPoints(klines, 40, 150);
    this.charting.addTrendLineBreakthroughs(klines);

    klines.forEach((kline, i) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const breakthroughs: TrendLine[] | undefined = kline.chart?.trendLineBreakthroughs;

      if (breakthroughs?.length) {
        let score = 0;  // a score of how bullish (positive) or bearish (negative) the breakthrough is
        let signalPricesSum = 0;
        let averagePriceChangeSum = 0;

        breakthroughs.forEach((trendLine: TrendLine) => {
          const length: number = trendLine.length;
          const position: Position = trendLine.position;
          const directionScore: number = length / 100;  // e.g. trend line of length 120 gets 1.2 score, more than a line with length 50 (0.5). the longer the trend line, the more meaningful the breakthrough
          const trendLineScore: number = position === Position.Above ? directionScore : directionScore * -1;  // score becomes negative if breakthrough is to the downside
          score += trendLineScore;
          const lineFunction = new LinearFunction(trendLine.function.m, trendLine.function.b);
          const breakthoughPrice = lineFunction.getY(trendLine.breakThroughIndex!);
          signalPricesSum += breakthoughPrice;
          const trendLineCloses: number [] = klines.slice(trendLine.startIndex, trendLine.endIndex).map(kline => kline.prices.close);
          const averagePriceChange: number = this.calcAverageChangeInPercent(trendLineCloses);
          averagePriceChangeSum += averagePriceChange;
        });

        const averagePriceChange: number = averagePriceChangeSum / breakthroughs.length;
        const stopLoss: number  = averagePriceChange / 2;
        const takeProfit: number = stopLoss * 5;

        if (score > 0) {
          backtest.signal = Signal.Buy;
          backtest.amount = score;
          const averageBreakthoughPrice = kline.algorithms[algorithm]!.signalPrice = signalPricesSum / breakthroughs.length;
          backtest.signalPrice = averageBreakthoughPrice;
          backtest.positionCloseTrigger = { stopLoss, takeProfit };
        } else if (score < 0) {
          backtest.signal = Signal.Sell;
          backtest.amount = Math.abs(score);
          const averageBreakthoughPrice = kline.algorithms[algorithm]!.signalPrice = signalPricesSum / breakthroughs.length;
          backtest.signalPrice = averageBreakthoughPrice;
          backtest.positionCloseTrigger = { stopLoss, takeProfit };
        }
      }
    });

    this.addTpSlSignals(klines, algorithm);
    return klines;
  }
}