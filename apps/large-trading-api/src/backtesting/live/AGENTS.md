# Live Backtesting

## Intention

Historical backtests and eventual live trading must use the same strategy and backtester engine so trading decisions and accounting do not acquire separate implementations.

Shared logic does not imply identical results: live prices expose observations that historical bars do not.

## Design Principles

- Current prices are point observations, not reconstructed historical candles. The exchange remains the authority for historical market data.
- Repeated observations within one timeframe must not advance bar-based calculations as though multiple bars had elapsed.
- Observed discoveries and invalidations remain meaningful after prices change. Preserving that information requires a deliberate distinction between lasting observations and provisional calculations.
- A strategy can finish making decisions for the current bar before that bar closes. Open positions remain exposed to price changes regardless.
- Historical confirmation must not repeat trading effects that already occurred during live processing.
