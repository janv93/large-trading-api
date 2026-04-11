import { Algorithm, BacktestData, BacktestSignal, Kline, Signal } from '../../../../interfaces';
import Base from '../../../../base';

export default class Example extends Base {
  public setSignals(klines: Kline[], algorithm: Algorithm, size: number): Kline[] {
    const interval = Math.floor(klines.length / 11);

    klines.forEach((kline: Kline, index: number) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;

      // Section 0: Buy + CloseAll
      if (index === interval * 0) signals.push({ signal: Signal.Buy, size, price: closePrice });
      if (index === interval * 1) signals.push({ signal: Signal.CloseAll, price: closePrice });

      // Section 1: Sell + CloseAll
      if (index === interval * 2) signals.push({ signal: Signal.Sell, size, price: closePrice });
      if (index === interval * 3) signals.push({ signal: Signal.CloseAll, price: closePrice });

      // Section 2: Buy + tpSl (auto-close at +5% take profit or -2% stop loss)
      if (index === interval * 4) {
        signals.push({
          signal: Signal.Buy,
          size,
          price: closePrice,
          positionCloseTrigger: {
            tpSl: { takeProfit: 0.05, stopLoss: 0.02 }
          }
        });
      }

      // Section 3: Sell + tSl (trailing stop, trails 3% above lowest price since entry)
      if (index === interval * 5) {
        signals.push({
          signal: Signal.Sell,
          size,
          price: closePrice,
          positionCloseTrigger: {
            tSl: { stopLoss: 0.03 }
          }
        });
      }

      // Section 4: Buy + tSl + percentOfProfit (trailing stop that also locks in 50% of peak profit)
      if (index === interval * 6) {
        signals.push({
          signal: Signal.Buy,
          size,
          price: closePrice,
          positionCloseTrigger: {
            tSl: { stopLoss: 0.03, percentOfProfit: 0.5 }
          }
        });
      }

      // Section 5: Buy + Close (close one specific position by klineIndex/signalIndex reference)
      if (index === interval * 10) signals.push({ signal: Signal.Buy, size, price: closePrice });
      if (index === interval * 11) {
        signals.push({
          signal: Signal.Close,
          price: closePrice,
          openSignalReferences: [{ klineIndex: interval * 10, signalIndex: 0 }]
        });
      }
    });

    return klines;
  }
}
