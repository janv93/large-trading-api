import { Algorithm, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../../../../../base';

export default class Example extends Base {
  public setSignals(bars: Bar[], algorithm: Algorithm, params: any): void {
    const size: number = Number(params.size);
    const interval = Math.floor(bars.length / 11);

    this.forEachWithProgress(bars, (bar: Bar, index: number) => {
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = bar.prices.close;

      // Buy + CloseAll
      if (index === interval * 0) signals.push({ signal: Signal.Buy, size, price: closePrice });
      if (index === interval * 1) signals.push({ signal: Signal.CloseAll, price: closePrice });

      // Sell + CloseAll
      if (index === interval * 2) signals.push({ signal: Signal.Sell, size, price: closePrice });
      if (index === interval * 3) signals.push({ signal: Signal.CloseAll, price: closePrice });

      // Buy + Close (close one specific position by open signal reference)
      if (index === interval * 4) signals.push({ signal: Signal.Buy, size, price: closePrice });
      if (index === interval * 5) {
        signals.push({
          signal: Signal.Close,
          price: closePrice,
          openSignalReferences: [{ barIndex: interval * 4, signalIndex: 0 }]
        });
      }

      // Buy + tpSl (close at +5% take profit or -2% stop loss)
      if (index === interval * 6) {
        signals.push({
          signal: Signal.Buy,
          size,
          price: closePrice,
          positionCloseTrigger: {
            tpSl: { takeProfit: 0.05, stopLoss: 0.02 }
          }
        });
      }

      // Sell + trailing stoploss (trails 3% above lowest price since entry)
      if (index === interval * 7) {
        signals.push({
          signal: Signal.Sell,
          size,
          price: closePrice,
          positionCloseTrigger: {
            tSl: { stopLoss: 0.03 }
          }
        });
      }

      // Buy + trailing stoploss + percentOfProfit (locks in 50% of peak profit)
      if (index === interval * 8) {
        signals.push({
          signal: Signal.Buy,
          size,
          price: closePrice,
          positionCloseTrigger: {
            tSl: { stopLoss: 0.03, percentOfProfit: 0.5 }
          }
        });
      }
    });

  }
}
