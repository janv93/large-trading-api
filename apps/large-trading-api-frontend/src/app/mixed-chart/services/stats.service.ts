import { Injectable } from '@angular/core';
import { Kline, Algorithm, BacktestSignal, BacktestStats, Signal } from '@shared';

@Injectable({ providedIn: 'root' })
export class StatsService {
  public calcStats(klines: Kline[], algorithm: Algorithm, finalProfit: number): BacktestStats {
    const tradesCount: number = klines.reduce((acc: number, kline: Kline) => {
      const backtestSignals: BacktestSignal[] = kline.algorithms[algorithm]!.signals;
      return acc + backtestSignals.filter((s: BacktestSignal) => !this.isCloseSignal(s.signal)).length;
    }, 0);

    return {
      profit: Number(finalProfit.toFixed(2)),
      numberOfTrades: tradesCount,
      maxDrawback: Number(this.calcMaxDrawback(klines, algorithm).toFixed(2))
    };
  }

  public getDrawbackColor(value: number, maxGreen: number, maxRed: number): string {
    if (value < 0) return 'rgb(255, 77, 77)';

    const range: number = maxRed - maxGreen;

    if (value <= maxGreen) return 'rgb(0, 255, 0)';
    if (value >= maxRed) return 'rgb(255, 77, 77)';

    const t: number = (value - maxGreen) / range;
    const red: number = Math.floor(255 * t);
    const green: number = Math.floor(255 * (1 - t) + 77 * t);
    const blue: number = Math.floor(77 * t);
    return `rgb(${red}, ${green}, ${blue})`;
  }

  private calcMaxDrawback(klines: Kline[], algorithm: Algorithm): number {
    let high: number = 0;
    let maxDrawback: number = 0;

    klines.forEach((kline: Kline) => {
      const profit: number = (kline.algorithms[algorithm]!.profit || 0) * 100;
      high = Math.max(high, profit);
      maxDrawback = Math.max(maxDrawback, high - profit);
    });

    return maxDrawback;
  }

  private isCloseSignal(signal?: Signal): boolean {
    if (!signal) return false;
    return [Signal.CloseAll, Signal.Close, Signal.Liquidation, Signal.TakeProfit, Signal.StopLoss].includes(signal);
  }
}
