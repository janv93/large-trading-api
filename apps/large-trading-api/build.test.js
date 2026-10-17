const { afterAll, beforeAll, describe, expect, it } = require('@jest/globals');
const { execFileSync } = require('node:child_process');
const { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { join, relative, resolve } = require('node:path');
const { Worker } = require('node:worker_threads');

const outputDir = resolve(__dirname, '../../dist/apps/large-trading-api');
const sourceDir = join(__dirname, 'src');
const fixturePrefix = '.singleton-build-';

describe('bundled backend', () => {
  let fixtureDir;
  let fixtureOutputDir;

  beforeAll(() => {
    // A killed test run leaves its fixture in src, where later builds would pick it up.
    const leftoverFixtures = readdirSync(sourceDir).filter((name) => name.startsWith(fixturePrefix));

    for (const name of leftoverFixtures) {
      rmSync(join(sourceDir, name), { recursive: true, force: true });
    }

    fixtureDir = mkdtempSync(join(sourceDir, fixturePrefix));
    fixtureOutputDir = join(outputDir, relative(sourceDir, fixtureDir));
    writeFileSync(join(fixtureDir, 'singleton.ts'), 'class FixtureSingleton {}\nexport default new FixtureSingleton();\n');
    writeFileSync(
      join(fixtureDir, 'consumer.ts'),
      "import singleton from './singleton';\nclass FixtureConsumer { public singleton = singleton; }\nexport default new FixtureConsumer();\n",
    );
    writeFileSync(
      join(fixtureDir, 'js-consumer.ts'),
      "import singleton from './singleton.js';\nclass FixtureJsConsumer { public singleton = singleton; }\nexport default new FixtureJsConsumer();\n",
    );
    writeFileSync(join(fixtureDir, 'ordinary.ts'), "export default 'export default new NotASingleton()';\n");
    execFileSync(process.execPath, ['build.mjs'], { cwd: __dirname, timeout: 30_000 });
  }, 30_000);

  afterAll(() => {
    if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
    if (fixtureOutputDir) rmSync(fixtureOutputDir, { recursive: true, force: true });
  });

  it('automatically shares new singleton exports and ignores matching text in strings', () => {
    const singleton = require(join(fixtureOutputDir, 'singleton.js')).default;
    const consumer = require(join(fixtureOutputDir, 'consumer.js')).default;

    expect(consumer.singleton).toBe(singleton);
    expect(existsSync(join(fixtureOutputDir, 'ordinary.js'))).toBe(false);
  });

  it('shares the same singleton when imported with a .js extension', () => {
    const singleton = require(join(fixtureOutputDir, 'singleton.js')).default;
    const consumer = require(join(fixtureOutputDir, 'js-consumer.js')).default;

    expect(consumer.singleton).toBe(singleton);
  });

  it('starts with one database and shared exchange clients without contacting live services', () => {
    execFileSync(
      process.execPath,
      [
        '-e',
        `
      const assert = require('node:assert/strict');
      const Module = require('node:module');
      const path = require('node:path');
      const mongoose = require('mongoose');
      const express = require('express');
      const output = path.resolve('../../dist/apps/large-trading-api');
      let connections = 0, registrations = 0, listens = 0;
      const model = mongoose.model.bind(mongoose);
      mongoose.connect = async () => { connections++; return mongoose; };
      mongoose.model = (...args) => {
        if (args.length > 1) registrations++;
        return model(...args);
      };
      express.application.listen = (...args) => {
        listens++;
        queueMicrotask(args.at(-1));
        return { address: () => ({ address: '127.0.0.1', port: 0 }) };
      };
      const database = require(path.join(output, 'data/database.js')).default;
      database.deleteOutdatedBars = async () => 0;
      database.getHadStockSplitCleanup = async () => true;
      const clients = {
        binance: require(path.join(output, 'exchanges/binance.js')),
        alpaca: require(path.join(output, 'exchanges/alpaca.js')),
      };
      const imports = new Set();
      const load = Module._load;
      Module._load = function(name, parent, ...args) {
        const result = load.call(this, name, parent, ...args);
        for (const exchange of Object.keys(clients)) {
          if (result === clients[exchange] && parent?.filename.startsWith(output)) {
            imports.add(path.relative(output, parent.filename).replaceAll('\\\\', '/') + ':' + exchange);
          }
        }
        return result;
      };
      require(path.join(output, 'app.js'));
      setImmediate(() => {
        assert.equal(connections, 1);
        assert.equal(registrations, 7);
        assert.equal(listens, 1);
        for (const exchange of Object.keys(clients)) {
          assert.ok(imports.has('app.js:' + exchange), 'app must share ' + exchange);
          assert.ok(imports.has('backtesting/live/live.js:' + exchange), 'live must share ' + exchange);
        }
      });
    `,
      ],
      { cwd: __dirname, timeout: 10_000 },
    );
  });

  it('loads every discovered strategy with its original class name and module identity', () => {
    execFileSync(
      process.execPath,
      [
        '-e',
        `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const path = require('node:path');
      const output = path.resolve('../../dist/apps/large-trading-api/strategies');
      const entries = fs.readdirSync('src/strategies', { recursive: true });
      const files = entries.filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts'));
      assert.ok(files.length > 0);
      for (const file of files) {
        const filename = path.join(output, file.replace(/\\.ts$/, '.js'));
        const Strategy = require(filename).default;
        assert.equal(typeof Strategy, 'function');
        assert.ok(Strategy.name);
        const instance = new Strategy();
        assert.equal(Object.keys(require.cache).find(key => require.cache[key]?.exports?.default === instance.constructor), filename);
      }
      assert.equal(require(path.join(output, 'trend-line.js')).default.name, 'TrendLineBreakthrough');
    `,
      ],
      { cwd: __dirname, timeout: 10_000 },
    );
  });

  it('runs the bundled live worker with a dynamically loaded strategy', async () => {
    const worker = new Worker(join(outputDir, 'backtesting/live/worker.js'), {
      workerData: {
        bars: [createHistoricalBar()],
        strategyConfig: { size: 1 },
        strategyModulePath: join(outputDir, 'strategies/example.js'),
        timeframeMs: 60_000,
        intervalMs: 1,
        commission: 0,
      },
    });

    try {
      const bar = await waitForWorkerMessage(worker, (message) => {
        if (message === 'getLatestPrice') {
          worker.postMessage({ price: 101 });
          return false;
        }

        return typeof message === 'object';
      });

      expect(bar.prices.close).toBe(101);
    } finally {
      await worker.terminate();
    }
  });

  it('runs the bundled parameter-search worker with a dynamically loaded strategy', async () => {
    const encoded = Buffer.from(JSON.stringify([[createHistoricalBar()]]));
    const sharedBuffer = new SharedArrayBuffer(encoded.byteLength);
    new Uint8Array(sharedBuffer).set(encoded);
    const worker = new Worker(join(outputDir, 'backtesting/auto-params/worker.js'), {
      workerData: {
        sharedBuffer,
        bufferLength: encoded.byteLength,
        combo: { size: 1 },
        strategyModulePath: join(outputDir, 'strategies/example.js'),
      },
    });

    try {
      const message = await waitForWorkerMessage(worker, (message) => Boolean(message.result));
      expect(message.result.params).toEqual({ size: 1 });
    } finally {
      await worker.terminate();
    }
  });
});

function createHistoricalBar() {
  return {
    symbol: 'BENCH',
    exchange: 'BINANCE',
    timeframe: '1m',
    times: { open: Date.now() - 60_000 },
    prices: { open: 100, high: 100, low: 100, close: 100 },
    volume: 0,
    backtest: { signals: [] },
  };
}

function waitForWorkerMessage(worker, isExpectedMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Bundled worker did not respond')), 3000);
    const onError = (error) => finish(error);
    const onExit = (code) => finish(new Error('Bundled worker exited before responding: ' + code));
    const onMessage = (message) => {
      if (isExpectedMessage(message)) finish(undefined, message);
    };

    function finish(error, message) {
      clearTimeout(timeout);
      worker.off('error', onError);
      worker.off('exit', onExit);
      worker.off('message', onMessage);

      if (error) reject(error);
      else resolve(message);
    }

    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.on('message', onMessage);
  });
}
