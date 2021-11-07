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
- [x] Find profitable and linear/consistent algorithm on 100k+ / max timeframes (Currently: EMA 80 on BTC 1h, linear, 320% on max time span)
- [x] When profitable: Start forward test with Binance

### WIP:

- [ ] Tensorflow network for price prediction.


## Note:

- Install software requiements for tensorflow in order to use GPU: https://www.tensorflow.org/install/gpu. As of 11/7/21 you can use the latest version (it states CUDA 11.2 and cuDNN 8.1.0 but latest is tested and works, GPU gets registered "Created device /job:localhost/replica:0/task:0/device:GPU:0 with 8963 MB memory:  -> device: 0, name: NVIDIA GeForce RTX 2080 Ti")