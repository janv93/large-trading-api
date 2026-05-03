# Large Trading API

Backtest any custom trading algorithm on cryptos, stocks, ETFs. The code provides an infrastructure for backtesting. You may add your own custom algorithms.

<div float="left">
  <img src="https://github.com/janv93/large-trading-api/blob/main/libs/shared/github-content/single.png" width="49%" />
  <img src="https://github.com/janv93/large-trading-api/blob/main/libs/shared/github-content/multi.png" width="49%" />
</div>

## Projects

| Project | Path | Description |
|---|---|---|
| `large-trading-api` | `apps/large-trading-api` | Node.js backend — backtesting engine |
| `large-trading-api-frontend` | `apps/large-trading-api-frontend` | Angular frontend — charting and visualization using Lightweight Charts |

## Getting Started

### Requirements
- Node.js (e.g. 22.16.0 + npm 11.2.0)
- MongoDB (local or cloud)
- API keys for at least one exchange: Binance, KuCoin, or Alpaca (Binance + Alpaca recommended for full ticker coverage)

### Setup
1. Add credentials of at least 1 exchange and MongoDB connection string to `apps/large-trading-api/.env` (copy from `apps/large-trading-api/_.env`)
2. Install dependencies from the monorepo root:
   ```bash
   npm install
   ```
3. Start the backend:
   ```bash
   npm run be
   ```
4. Start the frontend:
   ```bash
   npm run fe
   ```
5. Open [http://localhost:4200](http://localhost:4200)

## Add and use backtests

1. Add or use existing backtests in `apps/large-trading-api/src/controllers/algorithms/backtests/` — see `simple-backtests/example.ts` for reference
2. Add algo to `apps/large-trading-api-frontend/src/app/algorithm-configs.ts` which contains the variable parameters sent over the API
3. Add algo to `apps/large-trading-api/src/controllers/routes.ts`
4. Set generic parameters in `apps/large-trading-api-frontend/src/app/chart.service.ts`

## Todos

- [ ] Find smart algo for closing positions (currently static tp/sl etc.)
- [ ] Candlesticks patterns
- [ ] RSI divergence
- [ ] Enhance trend line algo with >2 line touches and retests
- [ ] Consider more data like pausing positions during FOMC
- [ ] Screener (?)

## Notes

- This repo has merged into a monorepo with the frontend
- Tensorflow code commented out due to software requirements
- Tried C++ NAPI addons for calculations — much slower than TypeScript due to serialization overhead
- Tried worker threads — much slower due to serialization between main thread and worker

## Questions

Feel free to open an issue or start a discussion for questions, ideas, or anything else.
