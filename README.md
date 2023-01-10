# Large Trading API
This API allows to backtest any custom trading algorithm on crypto currencies (eventually also the stock/index market).
A backtest is a test of an algorithm on historical data.

Frontend: [Trading Chart Visualizer](https://github.com/janv93/trading-chart-visualizer)

## Status:

### Done:

- [x] Fetch stock, index and crypto candlestick data
- [x] Caching candlesticks in data base
- [x] Indicators
- [x] Algorithms setting position signals on past data

### Todo:

- [ ] AI: Transformer as improvement to standard NNs (position encoding time steps)
- [ ] Algorithm that builds strategies using multiple indicators and figuring out which combined indicators work the best

### How to use backtests:

- either start the frontend project [Trading Chart Visualizer](https://github.com/janv93/trading-chart-visualizer) or call manually

- add credentials file (.env) to call APIs
- add or use existing algorithms in src/controllers/algorithms/
- when adding new algorithm, add settings for algorithm to frontend code
- npm i, npm start
- initialize data, e.g. localhost:3000/initKlines?exchange=binance&symbol=BTCUSDT&timeframe=1h (this is also done by the frontend)
- call algorithm, e.g. localhost:3000/klinesWithAlgorithm?algorithm=deepTrend&symbol=BTCUSDT&timeframe=1h&times=10 (this is also done by the frontend)

## Note:

- Install software requiements for tensorflow in order to use GPU: https://www.tensorflow.org/install/gpu. As of 11/7/21 you can use the latest version (it states CUDA 11.2 and cuDNN 8.1.0 but latest is tested and works, GPU gets registered "Created device /job:localhost/replica:0/task:0/device:GPU:0 with 8963 MB memory:  -> device: 0, name: NVIDIA GeForce RTX 2080 Ti")
- You can replace @tensorflow/tfjs-node-gpu with @tensorflow/tfjs-node to use CPU instead. This can greatly increase performance, depending on the network shape (neurons/cells per layer must be very large for GPU advantage) and your hardware.
