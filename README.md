[WIP]

# LargeTradingAPI
This node API fulfills all the fundamental necessities of trading automation, including unique and combined trading strategies, backtesting, price prediction and executive behavior like opening and closing positions.

Frontend: [AngularChartVisualizer](https://github.com/janv93/AngularChartVisualizer)

## Status:

### Done:

- [x] Fetch Binance candlestick data
- [x] Caching candlesticks in data base
- [x] Indicators working: EMA, RSI, MACD (same as Binance/TradingView)
- [x] Basic Algorithms setting position signals
- [x] Backtesting position signals
- [x] Find profitable and linear/consistent algorithm on 100k+ / max timeframes (Currently: EMA 80 on BTC, linear, 320% on max time span)

### TBD:

- [ ] When profitable: Start forward test with Binance
- [ ] Implement Machine Learning: Linear regression on indicators, LSTM on closes
