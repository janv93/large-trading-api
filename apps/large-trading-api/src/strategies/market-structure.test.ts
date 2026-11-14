import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Bar, Direction, Exchange, Signal, Timeframe } from '@shared';
import MarketStructureController from '../patterns/pivot-point/market-structure';
import MarketStructure from './market-structure';

function createBar(openTime: number, price: number): Bar {
  return {
    symbol: 'BTCUSDT',
    exchange: Exchange.Binance,
    timeframe: Timeframe._1Minute,
    times: { open: openTime },
    prices: { open: price, high: price, low: price, close: price },
    volume: 0,
    backtest: { signals: [] },
  };
}

describe('market-structure strategy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { reversal: Direction.Up, signal: Signal.Buy },
    { reversal: Direction.Down, signal: Signal.Sell },
  ])('emits a $signal and finishes the bar on a $reversal reversal', ({ reversal, signal }) => {
    jest.spyOn(MarketStructureController.prototype, 'stepMarketStructure').mockReturnValue(reversal);
    const strategy = new MarketStructure();
    const state: any = {};
    const bars: Bar[] = [createBar(0, 100)];

    strategy.stepSetSignals(bars, state, { space: 2 });

    expect(bars[0].backtest.signals).toEqual([{ signal, size: 1, price: 100 }]);
    expect(state.barDone).toBe(true);
  });

  it('emits nothing without a reversal', () => {
    jest.spyOn(MarketStructureController.prototype, 'stepMarketStructure').mockReturnValue(undefined);
    const strategy = new MarketStructure();
    const state: any = {};
    const bars: Bar[] = [createBar(0, 100)];

    strategy.stepSetSignals(bars, state, { space: 2 });

    expect(bars[0].backtest.signals).toEqual([]);
    expect(state.barDone).toBeUndefined();
  });

  it('emits buys and sells with the real controller', () => {
    const strategy = new MarketStructure();
    const state: any = {};
    const bars: Bar[] = [];
    const signals: Signal[] = [];
    let seed: number = 1;
    let price: number = 100;

    for (let index = 0; index < 600; index++) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      price = Math.round((price + (seed / 2_147_483_648 - 0.5) * 4) * 2) / 2;
      bars.push(createBar(index * 60_000, price));
      strategy.stepSetSignals(bars, state, { space: 2 });
      signals.push(...bars.at(-1)!.backtest.signals.map((backtestSignal) => backtestSignal.signal));
    }

    expect(signals).toContain(Signal.Buy);
    expect(signals).toContain(Signal.Sell);
  });
});
