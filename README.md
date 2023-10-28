# Large Trading API
This API allows to backtest any custom trading algorithm on symbols like cryptos, stocks, etfs, forex.\
A backtest is a test of an algorithm on historical data.\
The code provides an infrastructure for backtesting. You may then add your own custom algorithms. Have fun!

Frontend: [Trading Chart Visualizer](https://github.com/janv93/trading-chart-visualizer)

## Status:

### Done:

- [x] Fetch stock, index and crypto candlestick data
- [x] Caching candlesticks in data base
- [x] Indicators
- [x] Algorithms setting position signals on past data
- [x] Sentiment analysis of popular Twitter traders using Twitter API and OpenAI API
- [x] Backtesting multiple tickers at once

### Todo:

- [ ] AI: Transformer as improvement to standard NNs (position encoding time steps)
- [ ] Algorithm that builds strategies using multiple indicators and figuring out which combined indicators work the best

## How to use backtests:

1. either start the [frontend](https://github.com/janv93/trading-chart-visualizer) or call manually
2. add credentials file (.env) to call APIs (most importantly binance or alpaca for ticker retrieval)
3. add or use existing algorithms in src/controllers/algorithms/
4. when adding new algorithm, add settings for algorithm to frontend code
5. npm i, npm start
6. call algorithm, e.g. localhost:3000/klinesWithAlgorithm?exchange=binance&algorithm=ema&symbol=BTCUSDT&timeframe=1h&times=10 (also done by frontend)
7. take response from klinesWithAlgorithm and POST it to localhost:3000/backtest?commission=0&flowingProfit=false (also done by frontend
8. response of /backtest contains the klines with with calculated profits

## Requirements:

- node
- install or use mongodb web version
- get api keys and secret of one of 3 exchanges: binance, kucoin, alpaca (recommended binance+alpaca for all tickers)

## Notes/Learnings:

- Tensorflow code commented out because of software requirements
- Tried C++ NAPI addons for calculations (backtest) - Much slower than typescript because of serialization
- Tried worker threads - Much slower because of serialization between main thread and worker
