import { Algorithm, BacktestData, BacktestSignal, Kline, Signal } from '../../../../interfaces';
import Base from '../../../../base';

export default class Example extends Base {
  public setSignals(klines: Kline[], algorithm: Algorithm, size: number): Kline[] {
    const interval = Math.floor(klines.length / 11);

    this.forEachWithProgress(klines, (kline: Kline, index: number) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;

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
          openSignalReferences: [{ klineIndex: interval * 4, signalIndex: 0 }]
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

    return klines;
  }
}
