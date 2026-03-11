import { Algorithm, BacktestData, BacktestSignal, Kline, Signal, TrendLine, TrendLinePosition } from '../../../../interfaces';
import Base from '../../../../base';
import Charting from '../../patterns/charting';
import { LinearFunction } from '../../patterns/linear-function';

export default class TrendLineBreakthrough extends Base {
  private charting = new Charting();
  private strategy = 'tSl'; // 'tpSl' or 'tSl'

  public setSignals(klines: Kline[], algorithm: Algorithm, percentOfProfit: number): Kline[] {
    this.charting.addTrendLines(klines, 40, 200);
    this.charting.addTrendLineBreakthroughs(klines);
    this.charting.filterTrendLinesWithoutBreakthroughs(klines);

    klines.forEach((kline) => {
      const breakthroughs: TrendLine[] | undefined = kline.chart?.trendLineBreakthroughs;

      breakthroughs?.forEach((trendLine: TrendLine) => {
        const length: number = trendLine.length;
        const position: TrendLinePosition = trendLine.position;
        const score: number = length / 100;  // e.g. trend line of length 120 gets 1.2 score, more than a line with length 50 (0.5). the longer the trend line, the more meaningful the breakthrough
        const lineFunction = new LinearFunction(trendLine.function.m, trendLine.function.b);
        const breakthoughPrice: number = lineFunction.getY(trendLine.breakThroughIndex!);
        const trendLineCloses: number[] = klines.slice(trendLine.startIndex, trendLine.endIndex).map(kline => kline.prices.close);
        const averagePriceChange: number = this.calcAverageChangeInPercent(trendLineCloses);
        const tp: number = averagePriceChange * 5;
        const sl: number = averagePriceChange * 2;

        if (position === TrendLinePosition.Above) {
          this.openBuyPosition(kline, algorithm, score, breakthoughPrice, tp, sl, percentOfProfit);
        } else if (position === TrendLinePosition.Below) {
          this.openSellPosition(kline, algorithm, score, breakthoughPrice, tp, sl, percentOfProfit);
        }
      });
    });

    return klines;
  }

  private openBuyPosition(kline: Kline, algorithm: Algorithm, score: number, breakthoughPrice: number, tp: number, sl: number, percentOfProfit: number): void {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;

    signals.push({
      signal: Signal.Buy,
      size: score,
      price: breakthoughPrice,
      positionCloseTrigger: this.strategy === 'tpSl' ? {
        tpSl: {
          stopLoss: sl,
          takeProfit: tp
        }
      } : {
        tSl: {
          stopLoss: sl,
          percentOfProfit
        }
      }
    });
  }

  private openSellPosition(kline: Kline, algorithm: Algorithm, score: number, breakthoughPrice: number, tp: number, sl: number, percentOfProfit: number): void {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;

    signals.push({
      signal: Signal.Sell,
      size: score,
      price: breakthoughPrice,
      positionCloseTrigger: this.strategy === 'tpSl' ? {
        tpSl: {
          stopLoss: sl,
          takeProfit: tp
        }
      } : {
        tSl: {
          stopLoss: sl,
          percentOfProfit
        }
      }
    });
  }
}