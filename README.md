# Large Trading API
This API allows to backtest any custom trading algorithm on symbols like cryptos, stocks, etfs, forex.\
A backtest is a test of an algorithm on historical data.\
The code provides an infrastructure for backtesting. You may then add your own custom algorithms. Have fun!

Frontend: [Trading Chart Visualizer](https://github.com/janv93/trading-chart-visualizer)
<div float="left">
  <img src="https://raw.githubusercontent.com/janv93/trading-chart-visualizer/main/github-content/chart.png" width="49%" />
  <img src="https://raw.githubusercontent.com/janv93/trading-chart-visualizer/main/github-content/multi-chart.png" width="49%" /> 
</div>

### Todo:

- [ ] Candlesticks patterns
- [ ] Finish and improve various backtest algos

## How to use backtests:

2. Add credentials file (.env) to call APIs (most importantly binance or alpaca for ticker retrieval)
3. Add or use existing backtests in src/controllers/algorithms/backtests
4. When adding new backtest, add settings for backtest to frontend code
5. npm i, npm start
6. Start the [frontend](https://github.com/janv93/trading-chart-visualizer)

## Requirements:

- node (e.g. 22.3.0 + npm 10.8.1)
- install mongodb or use its web version
- get api keys and secret of one of 3 exchanges: binance, kucoin, alpaca (recommended binance+alpaca for all tickers)

## Questions:

- feel free to open an issue if you have a question about how it works, if something is unclear, if you have ideas for improvements, really anything

## Notes/Learnings:

- Tensorflow code commented out because of software requirements
- Tried C++ NAPI addons for calculations (backtest) - Much slower than typescript because of serialization
- Tried worker threads - Much slower because of serialization between main thread and worker
