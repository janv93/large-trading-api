# Live Backtesting

## Intention

Live trading must run the same strategy and backtester code as historical backtests, so trading decisions and accounting exist only once, and a strategy behaves live the way it does in a backtest.

## Where the Design Comes From

Strategies were written for backtests. A backtest calls a strategy once per completed bar, and the strategy sees that bar's full open, high, low and close. Live trading cannot wait for the bar to complete, so it calls the same strategy many times during the bar, each time with only the current price. It deliberately does not pass the bar's earlier highs and lows, because that would let a decision look into the past.

Everything specific to live follows from this mismatch between "once per completed bar" and "many times during a bar":

- Strategies treat every call as a new bar, so every tick is evaluated from the state at the bar's start. Otherwise each tick would count as an extra bar.
- Starting over forgets what earlier ticks saw. Findings that must not be forgotten, such as a trend line that already broke or a signal that already traded, are carried from tick to tick by live. They are the same for every strategy, so live handles them once. Letting each strategy mark which of its values survive a tick was considered, but it would change every strategy, and one forgotten value would silently distort only live results.
- Trades made during the bar count as done. They are never undone, and closing the bar only records it instead of running anything again.

Live results therefore differ from a backtest on the same period: a live bar contains only the prices that were actually observed, and decisions were made on them as they arrived.
