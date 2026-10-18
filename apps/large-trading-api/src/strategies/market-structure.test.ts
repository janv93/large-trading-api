import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Bar, Direction, Exchange, MarketStructureStats, Signal, Timeframe } from '@shared';
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
    { direction: Direction.Up, previousDirection: Direction.Down },
    { direction: Direction.Down, previousDirection: Direction.Up },
  ])('does not qualify a $direction reversal using a streak from an earlier tick', ({ direction, previousDirection }) => {
    jest.spyOn(MarketStructureController.prototype, 'stepMarketStructure').mockImplementation(() => undefined);
    const strategy = new MarketStructure();
    const state: any = {};
    const bars: Bar[] = [createBar(0, 100)];
    bars[0].chart = { marketStructure: { streak: 4, direction: previousDirection } };
    strategy.stepSetSignals(bars, state, { space: 2 });

    bars.push(createBar(60_000, 101));
    bars[1].chart = { marketStructure: { streak: 6, direction: previousDirection } };
    strategy.stepSetSignals(bars, state, { space: 2 });
    expect(bars[1].backtest.signals).toEqual([]);

    bars[1].chart.marketStructure = { streak: 1, direction };
    strategy.stepSetSignals(bars, state, { space: 2 });

    expect(bars[1].backtest.signals).toEqual([]);
    expect(state.barDone).toBeUndefined();
  });

  it.each([
    { direction: Direction.Up, previousDirection: Direction.Down, signal: Signal.Buy },
    { direction: Direction.Down, previousDirection: Direction.Up, signal: Signal.Sell },
  ])('sizes a $signal from the completed bar instead of an earlier tick', ({ direction, previousDirection, signal }) => {
    jest.spyOn(MarketStructureController.prototype, 'stepMarketStructure').mockImplementation(() => undefined);
    const strategy = new MarketStructure();
    const state: any = {};
    const bars: Bar[] = [createBar(0, 100)];
    bars[0].chart = { marketStructure: { streak: 5, direction: previousDirection } };
    strategy.stepSetSignals(bars, state, { space: 2 });

    bars.push(createBar(60_000, 101));
    bars[1].chart = { marketStructure: { streak: 6, direction: previousDirection } };
    strategy.stepSetSignals(bars, state, { space: 2 });
    expect(bars[1].backtest.signals).toEqual([]);

    bars[1].chart.marketStructure = { streak: 1, direction };
    strategy.stepSetSignals(bars, state, { space: 2 });

    expect(bars[1].backtest.signals).toEqual([{ signal, size: 5, price: 101 }]);
    expect(state.barDone).toBe(true);
    expect(bars[0].chart.marketStructure).toEqual({ streak: 5, direction: previousDirection });
  });

  it('preserves historical signals and sizes with the real pivot controller', () => {
    const strategy = new MarketStructure();
    const state: any = {};
    const bars: Bar[] = [];
    const emittedSignals: Signal[] = [];
    let lastStats: MarketStructureStats | undefined;

    for (let index = 0; index < 360; index++) {
      const phase: number = index % 120;
      const price: number = 100 + (phase < 60 ? phase : 120 - phase) + [0, 3, -3][index % 3];
      state.barDone = false;
      bars.push(createBar(index * 60_000, price));
      strategy.stepSetSignals(bars, state, { space: 2 });
      const currentStats: MarketStructureStats | undefined = bars.at(-1)!.chart?.marketStructure;

      if (currentStats?.streak === 1 && lastStats && lastStats.streak > 4) {
        const signal: Signal = currentStats.direction === Direction.Up ? Signal.Buy : Signal.Sell;
        expect(bars.at(-1)!.backtest.signals).toEqual([{ signal, size: lastStats.streak, price }]);
        expect(state.barDone).toBe(true);
        emittedSignals.push(signal);
      } else {
        expect(bars.at(-1)!.backtest.signals).toEqual([]);
        expect(state.barDone).toBe(false);
      }

      if (currentStats) lastStats = currentStats;
    }

    expect(emittedSignals).toContain(Signal.Buy);
    expect(emittedSignals).toContain(Signal.Sell);
  });
});
