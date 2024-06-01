import { Signal } from './interfaces';

export class BaseComponent {
  constructor() { }

  protected isCloseSignal(signal?: Signal): boolean {
    if (!signal) return false;
    return [Signal.Close, Signal.Liquidation, Signal.TakeProfit, Signal.StopLoss].includes(signal);
  }

  protected isForceCloseSignal(signal?: Signal): boolean {
    const isCloseSignal: boolean = (this.isCloseSignal(signal));
    return isCloseSignal && signal !== Signal.Close;
  }
}