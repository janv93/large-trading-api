import { describe, expect, it, jest } from '@jest/globals';
import { Bar, Exchange, LiveLatestPriceResponse, Timeframe, clone } from '@shared';

describe('live worker', () => {
  it('finalizes observed OHLC locally and requests only current prices across bar boundaries', async () => {
    const historical: Bar = {
      symbol: 'BTCUSDT',
      exchange: Exchange.Binance,
      timeframe: Timeframe._1Minute,
      times: { open: 0, close: 59_999 },
      prices: { open: 10, high: 10, low: 10, close: 10 },
      volume: 100,
      backtest: { signals: [] },
    };

    const published: Bar[] = [];
    const requests: string[] = [];
    const strategyPrices: Bar['prices'][] = [];
    const backtesterPrices: Bar['prices'][] = [];
    const strategy = {
      stepSetSignals: jest.fn((bars: Bar[]) => {
        strategyPrices.push(clone(bars.at(-1)!.prices));
      }),
    };

    let price = 11;
    let respond!: (response: LiveLatestPriceResponse) => void;
    let resume!: () => void;
    let reachedSleep!: () => void;
    let sleeping = new Promise<void>((resolve) => {
      reachedSleep = resolve;
    });
    const now = jest.spyOn(Date, 'now').mockReturnValue(60_000);
    const strategyModulePath: string = require.resolve('../../strategies/example');

    jest.doMock('worker_threads', () => ({
      workerData: { bars: [historical], strategyConfig: {}, strategyModulePath, timeframeMs: 60_000, intervalMs: 1, commission: 0 },
      parentPort: {
        once: (_event: string, callback: typeof respond) => {
          respond = callback;
        },
        postMessage: (message: Bar | string) => {
          if (message === 'getLatestPrice') {
            requests.push(message);
            respond({ price });
          } else if (typeof message !== 'string') {
            published.push(clone(message));
          }
        },
      },
    }));
    jest.doMock('@shared', () => ({
      ...jest.requireActual<typeof import('@shared')>('@shared'),
      sleep: () =>
        new Promise<void>((resolve) => {
          resume = resolve;
          reachedSleep();
        }),
    }));
    jest.doMock('../../strategies/example', () => ({ __esModule: true, default: jest.fn(() => strategy) }));
    jest.doMock('../backtester/backtester', () => ({
      __esModule: true,
      default: jest.fn(() => ({
        stepCalcBacktestPerformance: (bars: Bar[]) => {
          backtesterPrices.push(clone(bars.at(-1)!.prices));
        },
      })),
    }));

    try {
      jest.isolateModules(() => {
        require('./worker');
      });
      await sleeping;
      const observations = [
        { time: 70_000, price: 16 },
        { time: 80_000, price: 8 },
        { time: 90_000, price: 12 },
        { time: 120_000, price: 20 },
      ];

      for (const observation of observations) {
        sleeping = new Promise<void>((resolve) => {
          reachedSleep = resolve;
        });
        price = observation.price;
        now.mockReturnValue(observation.time);
        resume();
        await sleeping;
      }

      expect(requests).toEqual(Array.from({ length: 5 }, () => 'getLatestPrice'));
      expect(published).toHaveLength(6);
      expect(published[4].times).toEqual({ open: 60_000, close: 119_999 });
      expect(published[4].prices).toEqual({ open: 11, high: 16, low: 8, close: 12 });
      expect(published[5].times.open).toBe(120_000);
      expect(published[5].prices).toEqual({ open: 20, high: 20, low: 20, close: 20 });
      const expectedPrices = [10, 11, 16, 8, 12, 20].map((value) => ({ open: value, high: value, low: value, close: value }));
      expect(strategyPrices).toEqual(expectedPrices);
      expect(backtesterPrices).toEqual(expectedPrices);
    } finally {
      now.mockRestore();
      jest.dontMock('worker_threads');
      jest.dontMock('@shared');
      jest.dontMock('../../strategies/example');
      jest.dontMock('../backtester/backtester');
    }
  });
});
