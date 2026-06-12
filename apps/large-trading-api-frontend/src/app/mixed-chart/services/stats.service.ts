import { Injectable } from '@angular/core';
import { Bar, Algorithm, BacktestSignal, BacktestStats, Signal } from '@shared';

@Injectable({ providedIn: 'root' })
export class StatsService {
  public calcStats(bars: Bar[], algorithm: Algorithm, finalProfit: number): BacktestStats {
    const tradesCount: number = bars.reduce((acc: number, bar: Bar) => {
      const backtestSignals: BacktestSignal[] = bar.algorithms[algorithm]!.signals;
      return acc + backtestSignals.filter((s: BacktestSignal) => !this.isCloseSignal(s.signal)).length;
    }, 0);

    return {
      profit: Number(finalProfit.toFixed(2)),
      numberOfTrades: tradesCount,
      maxDrawback: Number(this.calcMaxDrawback(bars, algorithm).toFixed(2))
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

  private calcMaxDrawback(bars: Bar[], algorithm: Algorithm): number {
    let high: number = 0;
    let maxDrawback: number = 0;

    bars.forEach((bar: Bar) => {
      const profit: number = (bar.algorithms[algorithm]!.profit || 0) * 100;
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
