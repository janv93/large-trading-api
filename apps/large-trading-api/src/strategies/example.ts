import { Strategy, BacktestData, BacktestSignal, Bar, Signal } from '@shared';
import Base from '../base';

export default class Example extends Base {
  public stepSetSignals(bars: Bar[], state: any, strategy: Strategy, params: any): void {
    const size: number = Number(params.size);
    const interval = Math.floor(1000 / 11);
    const i: number = bars.length - 1;
    const bar: Bar = bars[i];
    const backtest: BacktestData = bar.backtests[strategy]!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    if (i === interval * 0) signals.push({ signal: Signal.Buy, size, price: closePrice });
    if (i === interval * 1) signals.push({ signal: Signal.CloseAll, price: closePrice });
    if (i === interval * 2) signals.push({ signal: Signal.Sell, size, price: closePrice });
    if (i === interval * 3) signals.push({ signal: Signal.CloseAll, price: closePrice });
    if (i === interval * 4) signals.push({ signal: Signal.Buy, size, price: closePrice });
    if (i === interval * 5) signals.push({ signal: Signal.Close, price: closePrice, openSignalReferences: [{ barIndex: interval * 4, signalIndex: 0 }] });
    if (i === interval * 6) signals.push({ signal: Signal.Buy, size, price: closePrice, positionCloseTrigger: { tpSl: { takeProfit: 0.05, stopLoss: 0.02 } } });
    if (i === interval * 7) signals.push({ signal: Signal.Sell, size, price: closePrice, positionCloseTrigger: { tSl: { stopLoss: 0.03 } } });
    if (i === interval * 8) signals.push({ signal: Signal.Buy, size, price: closePrice, positionCloseTrigger: { tSl: { stopLoss: 0.03, percentOfProfit: 0.5 } } });
  }
}
