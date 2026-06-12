import Indicators from '../../../patterns/indicators';
import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../../../../../base';

export default class Macd extends Base {
  private indicators = new Indicators();

  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const fast = Number(params.fast);
    const slow = Number(params.slow);
    const signal = Number(params.signal);
    this.indicators.addMacd(bars, fast, slow, signal);
    const barsWithHistogram = bars.filter(k => k.indicators?.macd !== undefined);

    let lastHistogram: number;
    let lastMove: string;
    let positionOpen = false;
    let positionOpenType: Signal;

    barsWithHistogram.forEach((bar, index) => {
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;
      const h = bar.indicators!.macd!.histogram;

      if (!lastHistogram) {
        lastHistogram = h;
        return;
      }

      const move = h - lastHistogram > 0 ? 'up' : 'down';

      if (!lastMove) {
        lastMove = move;
      }

      const momentumSwitch = move !== lastMove;

      // buy when histogram is decreasing at high value or increasing at low value, sell when histogram hits 0
      if (momentumSwitch) {
        if (!positionOpen) {
          if (move === 'down' && h > 0) {
            if (h > 0.003) {
              signals.push({
                signal: Signal.CloseAll,
                price: closePrice
              });

              signals.push({
                signal: Signal.Sell,
                size: 1,
                price: closePrice
              });

              positionOpen = true;
              positionOpenType = Signal.Sell;
            }
          } else if (move === 'up' && h < 0) {
            if (h < -0.003) {
              signals.push({
                signal: Signal.CloseAll,
                price: closePrice
              });

              signals.push({
                signal: Signal.Buy,
                size: 1,
                price: closePrice
              });

              positionOpen = true;
              positionOpenType = Signal.Buy;
            }
          }
        } else {
          if ((positionOpenType === Signal.Sell && h < 0) || (positionOpenType === Signal.Buy && h > 0)) {
            signals.push({
              signal: Signal.CloseAll,
              price: closePrice
            });

            positionOpen = false;
          }
        }
      }

      lastHistogram = h;
      lastMove = move;
    });

  }

  /**
   * test different histogram strategies
   */
  private findOptimalEntry(bars: Bar[], histogram: any[]) {
    let lastHistogram: number;
    let lastMove: string;
    let sumDiffs = 0.0;
    let numberDiffs = 0.0;

    bars.forEach((bar, index) => {
      const h = histogram[index].histogram;
      const currentPrice = Number(bar.prices.close);

      if (!lastHistogram) {
        lastHistogram = h;
        return;
      }

      if (!lastMove) {
        lastMove = h - lastHistogram > 0 ? 'up' : 'down';
      }

      const move = h - lastHistogram > 0 ? 'up' : 'down';
      const momentumSwitch = move !== lastMove;

      const bar5Steps = bars[index + 20];
      const price5Steps = bar5Steps ? Number(bar5Steps.prices.close) : null;

      if (momentumSwitch && move === 'up') {
        if (price5Steps) {
          const priceDiff = price5Steps - currentPrice;
          sumDiffs += priceDiff;
          numberDiffs++;
        }
      }
    });

    const averageDiff = sumDiffs / numberDiffs;
    console.log(averageDiff);
  }
}