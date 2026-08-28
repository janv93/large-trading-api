import { stepRsi } from '../patterns/indicators/rsi';
import { BacktestData, BacktestSignal, Bar, Signal, createSignal } from '@shared';
import Base from '../base';

export default class Rsi extends Base {
  public stepSetSignals(bars: Bar[], state: any, params: any): void {
    const length = Number(params.length);
    state.rsi ??= {};
    stepRsi(bars, state.rsi, length);

    const bar: Bar = bars[bars.length - 1];
    const rsiValue: number | undefined = bar.indicators?.rsi;
    if (rsiValue === undefined) return;

    const rsiThresholdHigh = 60;
    const rsiThresholdLow = 40;
    const backtest: BacktestData = bar.backtest!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;

    if (state.lastSignal === Signal.Buy) {
      if (rsiValue > rsiThresholdHigh) {
        signals.push(createSignal({ uniqueIdentifier: Signal.CloseAll, signal: Signal.CloseAll, price: closePrice }));
        signals.push(createSignal({ uniqueIdentifier: Signal.Sell, signal: Signal.Sell, size: 1, price: closePrice }));
        state.lastSignal = Signal.Sell;
      }
    } else if (state.lastSignal === Signal.Sell) {
      if (rsiValue < rsiThresholdLow) {
        signals.push(createSignal({ uniqueIdentifier: Signal.CloseAll, signal: Signal.CloseAll, price: closePrice }));
        signals.push(createSignal({ uniqueIdentifier: Signal.Buy, signal: Signal.Buy, size: 1, price: closePrice }));
        state.lastSignal = Signal.Buy;
      }
    } else {
      if (rsiValue > rsiThresholdHigh) {
        signals.push(createSignal({ uniqueIdentifier: Signal.CloseAll, signal: Signal.CloseAll, price: closePrice }));
        signals.push(createSignal({ uniqueIdentifier: Signal.Sell, signal: Signal.Sell, size: 1, price: closePrice }));
        state.lastSignal = Signal.Sell;
      } else if (rsiValue < rsiThresholdLow) {
        signals.push(createSignal({ uniqueIdentifier: Signal.CloseAll, signal: Signal.CloseAll, price: closePrice }));
        signals.push(createSignal({ uniqueIdentifier: Signal.Buy, signal: Signal.Buy, size: 1, price: closePrice }));
        state.lastSignal = Signal.Buy;
      }
    }
  }

}