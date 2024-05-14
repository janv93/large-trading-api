import { Algorithm, BacktestData, Kline, Position, Signal } from '../../../../interfaces';
import Base from '../../../base';

export default class Backtester extends Base {
  /**
   * @param klines the klines returned from /klinesWithAlgorithm
   * @param commission commission of exchange, e.g. 0.04
   * @param flowingProfit when true, calculates profit for every kline (false calculates only at signals)
   * @returns the klines with profits
   */
  public calcBacktestPerformance(klines: Kline[], algorithm: Algorithm, commission: number, flowingProfit: boolean): Kline[] {
    let position: Position | undefined;
    let profit = 0;

    klines.forEach((kline: Kline, i) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signal: Signal | undefined = backtest.signal;
      const newPosition: Position | undefined = this.createPosition(kline, algorithm);  // transform the kline signal into a new position

      if (!position) {  // no open position
        position = newPosition;
        profit -= this.calcFee(position, newPosition, signal, commission);  // subtract fee from profit
        backtest.percentProfit = profit;
        backtest.openPositionSize = newPosition?.size || 0;
      } else {  // open position
        if (flowingProfit || !flowingProfit && signal) {
          console.log(i)
          position = this.setLiquidation(position, kline);  // check if liquidation
          console.log(position.isLiquidated)
          profit = this.updateProfit(profit, position, kline, algorithm); // calculate profit
          position = this.updateOldPosition(position, kline, algorithm);  // update position size
          profit -= this.calcFee(position, newPosition, signal, commission);  // subtract fee from profit
          if (signal && this.isAnyCloseSignal(signal)) position = undefined;  // optionally close position
          position = this.combinePositions(position, newPosition);  // add the new signal/position to the old one
          this.updateBacktestWithPosition(position, backtest, profit);  // transfer calculated data back into kline backtest
        }
      }
    });

    return klines;
  }

  private setLiquidation(position: Position, kline: Kline): Position {
    const size: number = position.size;
    const liquidationPrice: number = position.liquidationPrice;
    const currentHigh: number = kline.prices.high;
    const currentLow: number = kline.prices.low;

    if (size > 0) { // long
      position.isLiquidated = currentLow <= liquidationPrice; // for now, without leverage, long liquidation cannot be triggered (except weird cases like negative prices on oil, will not consider that)
    } else if (size < 0) {  //short
      position.isLiquidated = currentHigh >= liquidationPrice;
    }

    return position;
  }

  private updateProfit(profit: number, oldPosition: Position, kline: Kline, algorithm: Algorithm): number {
    const entryPrice: number = oldPosition.entryPrice;
    const lastPrice: number = oldPosition.price;
    const currentPrice: number = this.signalOrClosePrice(kline, algorithm);
    const diff: number = currentPrice - lastPrice;
    const change: number = diff / entryPrice;
    const entrySize: number = oldPosition.entrySize;
    const size: number = oldPosition.size;

    if (oldPosition.isLiquidated) {
      return profit - Math.abs(size) * 100;
    } else {
      return profit + change * entrySize * 100;
    }
  }

  /**
   * recalculates the existing position size and sets liquidation signal
   */
  private updateOldPosition(position: Position, kline: Kline, algorithm: Algorithm): Position {
    const entryPrice: number = position.entryPrice;
    const currentPrice: number = this.signalOrClosePrice(kline, algorithm);
    const priceChange: number = this.calcPriceChange(entryPrice, currentPrice);

    if (!position.isLiquidated) {
      if (position.size > 0) {  // long
        position.size = position.entrySize * (1 + priceChange);
        position.price = currentPrice;
      } else {  // short
        position.size = position.entrySize * (1 - priceChange);
        position.price = currentPrice;
      }
    }

    return position;
  }

  private calcFee(oldPosition: Position | undefined, newPosition: Position | undefined, signal: Signal | undefined, commission: number): number {
    let fee = 0;

    // (forced) closing position costs position size * commission
    if (oldPosition && (oldPosition.isLiquidated || this.isAnyCloseSignal(signal))) {
      fee += commission * Math.abs(oldPosition.size);
    }

    // opening position costs position size * commission
    if (newPosition) {
      fee += commission * Math.abs(newPosition.size);
    }

    return fee;
  }

  /**
   * updates the kline backtest with the calculated data
   */
  private updateBacktestWithPosition(position: Position | undefined, backtest: BacktestData, profit): void {
    backtest.openPositionSize = position?.size || 0;
    backtest.percentProfit = profit;

    if (position?.isLiquidated) {
      backtest.isLiquidation = true;
      backtest.signalPrice = position!.price; // overwrite the price, there is currently only one signal price possible per kline
      const signal: Signal | undefined = backtest.signal;

      if (this.isBuySignal(signal)) { // if liquidated, set a close signal and merge it with the new signal
        backtest.signal = Signal.CloseBuy;
      } else if (this.isSellSignal(signal)) {
        backtest.signal = Signal.CloseSell;
      } else {
        backtest.signal = Signal.Close;
      }
    }
  }
}