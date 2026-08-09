import { Algorithm, BacktestData, BacktestSignal, Bar, Signal, TrendLine, TrendLinePosition } from '@shared';
import Base from '../../../../base';
import { calcAverageChangeInPercent } from '@shared';
import TrendLineController from '../../../patterns/trend-line';

export default class TrendLineBreakthrough extends Base {
  private trendLineController = new TrendLineController();
  private strategy = 'tSl'; // 'tpSl' or 'tSl'

  public stepSetSignals(bars: Bar[], state: any, algorithm: Algorithm, params: any): void {
    const percentOfProfit: number = Number(params.percentOfProfit);
    state.trendLines ??= {};

    this.trendLineController.stepTrendLines(bars, state.trendLines, 40, 200, true, true);
    this.trendLineController.stepTrendLineBreakthroughs(bars, state.trendLines, true);

    const bar: Bar = bars[bars.length - 1];
    const breakthroughs: TrendLine[] | undefined = bar.chart?.trendLineBreakthroughs;
    if (!breakthroughs) return;

    breakthroughs.forEach((trendLine: TrendLine) => {
      const length: number = trendLine.length;
      const position: TrendLinePosition = trendLine.position;
      const score: number = length / 100;
      const breakthoughPrice: number = trendLine.function.getY(trendLine.breakThroughIndex!);
      const trendLineCloses: number[] = bars.slice(trendLine.startIndex, trendLine.endIndex).map(b => b.prices.close);
      const averagePriceChange: number = calcAverageChangeInPercent(trendLineCloses);
      const tp: number = averagePriceChange * 5;
      const sl: number = averagePriceChange * 2;

      if (position === TrendLinePosition.Above) {
        this.openBuyPosition(bar, algorithm, score, breakthoughPrice, tp, sl, percentOfProfit);
      } else if (position === TrendLinePosition.Below) {
        this.openSellPosition(bar, algorithm, score, breakthoughPrice, tp, sl, percentOfProfit);
      }
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