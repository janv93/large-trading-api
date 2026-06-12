import { Algorithm, BacktestData, BacktestSignal, Bar, Signal, TrendLine, TrendLinePosition } from '@shared';
import Base from '../../../../../base';
import { calcAverageChangeInPercent } from '@shared';
import { LinearFunction } from '@shared';
import TrendLineController from '../../../patterns/trend-line';
import PivotPointController from '../../../patterns/pivot-point';

export default class TrendLineBreakthrough extends Base {
  private trendLineController = new TrendLineController();
  private pivotPointController = new PivotPointController();
  private strategy = 'tSl'; // 'tpSl' or 'tSl'

  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const percentOfProfit: number = Number(params.percentOfProfit);
    // this.pivotPointController.addPivotPoints(bars, 20);
    // this.trendLineController.addTrendLinesFromPivotPoints(bars, 40, 200, true, true);
    this.trendLineController.addTrendLines(bars, 40, 200, true, true);
    this.trendLineController.addTrendLineBreakthroughs(bars, true);
    this.trendLineController.filterTrendLinesWithoutBreakthroughs(bars);

    this.forEachWithProgress(bars, (bar) => {
      const breakthroughs: TrendLine[] | undefined = bar.chart?.trendLineBreakthroughs;

      breakthroughs?.forEach((trendLine: TrendLine) => {
        const length: number = trendLine.length;
        const position: TrendLinePosition = trendLine.position;
        const score: number = length / 100;  // e.g. trend line of length 120 gets 1.2 score, more than a line with length 50 (0.5). the longer the trend line, the more meaningful the breakthrough
        const lineFunction = new LinearFunction(trendLine.function.m, trendLine.function.b);
        const breakthoughPrice: number = lineFunction.getY(trendLine.breakThroughIndex!);
        const trendLineCloses: number[] = bars.slice(trendLine.startIndex, trendLine.endIndex).map(bar => bar.prices.close);
        const averagePriceChange: number = calcAverageChangeInPercent(trendLineCloses);
        const tp: number = averagePriceChange * 5;
        const sl: number = averagePriceChange * 2;

        if (position === TrendLinePosition.Above) {
          this.openBuyPosition(bar, algorithm, score, breakthoughPrice, tp, sl, percentOfProfit);
        } else if (position === TrendLinePosition.Below) {
          this.openSellPosition(bar, algorithm, score, breakthoughPrice, tp, sl, percentOfProfit);
        }
      });
    });

  }

  private openBuyPosition(bar: Bar, algorithm: Algorithm, score: number, breakthoughPrice: number, tp: number, sl: number, percentOfProfit: number): void {
    const backtest: BacktestData = bar.algorithms[algorithm]!;
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

  private openSellPosition(bar: Bar, algorithm: Algorithm, score: number, breakthoughPrice: number, tp: number, sl: number, percentOfProfit: number): void {
    const backtest: BacktestData = bar.algorithms[algorithm]!;
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