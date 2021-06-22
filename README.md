WIP

# LargeTradingAPI
This node API fulfills all the fundamental necessities of trading automation, including unique and combined trading strategies, backtesting, price prediction and executive behavior like opening and closing positions.

## Status:

### Done:

- [x] Fetch Binance candlestick data
- [x] Indicators working: RSI, MACD (same as Binance/TradingView)
- [x] Basic Algorithms setting position signals
- [x] Backtesting position signals

### TBD:

- [ ] Caching candlesticks in data base
- [ ] Finding linear/consistent and profitable algorithm on 100k+ timeframes
- [ ] When profitable: Start forward test with Binance
- [ ] Implement Machine Learning: Linear regression on indicators, LSTM on closes
