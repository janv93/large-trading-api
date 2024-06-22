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

  // interpolates source value between source range to target value between target range
  protected interpolateValue(value: number, sourceMin: number, sourceMax: number, targetMin: number, targetMax: number): number {
    if (value < sourceMin) return targetMin;
    if (value > sourceMax) return targetMax;

    const sourceRange: number = sourceMax - sourceMin;
    const sourceFraction: number = value - sourceMin;
    const factor: number = sourceFraction / sourceRange;
    const targetRange: number = targetMax - targetMin;
    const targetValue: number = targetMin + factor * targetRange;
    return targetValue;
  }
}