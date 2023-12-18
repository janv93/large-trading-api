# Large Trading API
This API allows to backtest any custom trading algorithm on symbols like cryptos, stocks, etfs, forex.\
A backtest is a test of an algorithm on historical data.\
The code provides an infrastructure for backtesting. You may then add your own custom algorithms. Have fun!

Frontend: [Trading Chart Visualizer](https://github.com/janv93/trading-chart-visualizer)
<div float="left">
  <img src="https://raw.githubusercontent.com/janv93/trading-chart-visualizer/main/github-content/chart.png" width="49%" />
  <img src="https://raw.githubusercontent.com/janv93/trading-chart-visualizer/main/github-content/multi-chart.png" width="49%" /> 
</div>

## Status:

### Done:

- [x] Fetch stock, index and crypto candlestick data
- [x] Caching candlesticks in data base
- [x] Indicators
- [x] Algorithms setting position signals on past data
- [x] Sentiment analysis of popular Twitter traders using Twitter API and OpenAI API
- [x] Backtesting multiple tickers at once
- [x] Comparing algorithm profit curves

### Todo:

- [ ] AI: Transformer as improvement to standard NNs (position encoding time steps)
- [ ] Algorithm that builds strategies using multiple indicators and figuring out which combined indicators work the best
- [ ] Charting tools, e.g. backtests that test trend lines

## How to use backtests:

2. Add credentials file (.env) to call APIs (most importantly binance or alpaca for ticker retrieval)
3. Add or use existing algorithms in src/controllers/algorithms/backtests
4. When adding new algorithm, add settings for algorithm to frontend code
5. npm i, npm start
6. Start the [Frontend](https://github.com/janv93/trading-chart-visualizer)

## Requirements:

- node
- install or use mongodb web version
- get api keys and secret of one of 3 exchanges: binance, kucoin, alpaca (recommended binance+alpaca for all tickers)

## Notes/Learnings:

- Tensorflow code commented out because of software requirements
- Tried C++ NAPI addons for calculations (backtest) - Much slower than typescript because of serialization
- Tried worker threads - Much slower because of serialization between main thread and worker
