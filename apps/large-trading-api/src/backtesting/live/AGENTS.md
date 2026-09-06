# Live Backtesting

## Intention

Historical backtests and eventual live trading must use the same strategy and backtester engine so trading decisions and accounting do not acquire separate implementations.

Shared logic does not imply identical results: live prices expose observations that historical bars do not.

## Design Principles

- Live decisions use point-price observations. Completed live bars summarize only those observed ticks, so their OHLC can differ from exchange history. Historical data is used to initialize the engine, not to replay unobserved prices during live processing.
- Repeated observations within one timeframe must not advance bar-based calculations as though multiple bars had elapsed.
- Observed discoveries and invalidations remain meaningful after prices change. Preserving that information requires a deliberate distinction between lasting observations and provisional calculations.
- A strategy can finish making decisions for the current bar before that bar closes. Open positions remain exposed to price changes regardless.
- Recording a completed bar must not repeat trading effects or expose earlier price extremes to positions opened later in that bar.
