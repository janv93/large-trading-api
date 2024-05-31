import { Algorithm, BacktestData, BacktestSignal, CloseType, Kline, Position, PositionCloseTrigger, Signal, TakeProfitStopLoss } from '../../../../interfaces';
import Base from '../../../base';

export default class Backtester extends Base {
  /**
   * @param klines the klines returned from /klinesWithAlgorithm
   * @param commission commission of exchange, e.g. 0.04
   * @param flowingProfit when true, calculates profit for every kline (false calculates only at signals)
   * @returns the klines with profits
   */
  public calcBacktestPerformance(klines: Kline[], algorithm: Algorithm, commission: number, flowingProfit: boolean): Kline[] {
    let positions: Array<Position | undefined> = [];
    let profit = 0;

    klines.forEach((kline: Kline, i) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;

      positions = positions.map((position: Position | undefined) => {
        const closeType: CloseType | undefined = this.getCloseType(position!, kline, algorithm);

        if (this.isForceCloseType(closeType)) { // add force close to kline signals
          backtest.forceClose = closeType;
          const closePrice: number = this.getClosePrice(position!, closeType!, kline, algorithm);
          backtest.signals.push({ signal: Signal.ForceClose, price: closePrice });
        }

        if (flowingProfit || closeType) { // if flowing profit or (force) close, change existing positions
          profit += this.calcProfitChange(position!, kline, algorithm, closeType);
          if (closeType) profit -= this.calcCloseFee(position!, kline, algorithm, closeType, commission);
          return this.updateExistingPosition(position!, kline, closeType);
        } else {
          return position;
        }
      });

      positions = positions.filter((position: Position | undefined) => position !== undefined); // filter out all closed positions
      this.addNewPositions(positions as Position[], kline, algorithm);  // create new positions from signals
      profit -= this.calcOpenFee(kline, algorithm, commission);
      backtest.percentProfit = profit;
      backtest.openPositionSize = this.calcPositionSize(positions as Position[]);
    });

    return klines;
  }

  private calcPositionSize(positions: Position[]): number {
    return positions.reduce((acc: number, position: Position) => {
      return acc + position.size;
    }, 0);
  }

  private calcOpenFee(kline: Kline, algorithm: Algorithm, commission: number): number {
    let totalOpenFee = 0;
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;

    signals.forEach((signal: BacktestSignal) => {
      if (![Signal.Close, Signal.ForceClose].includes(signal.signal)) {
        totalOpenFee += commission * signal.size!
      }
    });

    return totalOpenFee;
  }

  private addNewPositions(positions: Position[], kline: Kline, algorithm: Algorithm) {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;

    signals.forEach((signal: BacktestSignal) => {
      if (![Signal.Close, Signal.ForceClose].includes(signal.signal)) {
        positions.push(this.createPosition(signal));
      }
    });
  }

  private createPosition(signal: BacktestSignal): Position {
    const signalSize: number = signal.size!;
    const signalPrice: number = signal.price;
    let size: number;
    let entrySize: number;
    let liquidationPrice: number;

    if (signal.signal === Signal.Buy) {
      size = signalSize;
      entrySize = signalSize;
      liquidationPrice = 0;
    } else if (signal.signal === Signal.Sell) {
      size = -signalSize;
      entrySize = -signalSize;
      liquidationPrice = signalPrice * 2;
    }

    return {
      size: size!,
      entrySize: entrySize!,
      price: signalPrice,
      entryPrice: signalPrice,
      liquidationPrice: liquidationPrice!
    };
  }

  private calcCloseFee(position: Position, kline: Kline, algorithm: Algorithm, closeType: CloseType, commission: number): number {
    if (closeType === CloseType.Liquidation) {
      // in case of liquidation, you don't pay a fee.
      // e.g. when normally closing a position that is worth 50$ from an orignal 100$, you pay the commission * 50$
      // now when the position is worth 0$ from an original 100$, you pay 0 commission
      return 0;
    } else {
      // first determine at which price the position was closed
      const entryPrice: number = position.entryPrice;
      const entrySize: number = position.entrySize;
      const currentSize: number = position.size;
      const currentPrice: number = this.getClosePrice(position, closeType, kline, algorithm);
      const priceChange: number = this.calcPriceChange(entryPrice, currentPrice!);
      // then determine the size of the position at close
      const sizeAtClose: number = currentSize > 0 ? entrySize * (1 + priceChange) : entrySize * (1 - priceChange);
      // then calculate commission on the final size
      const fee: number = commission * Math.abs(sizeAtClose);
      return fee;
    }
  }

  // update size and price of existing position or set position undefined if it was closed
  private updateExistingPosition(position: Position, kline: Kline, closeType: CloseType | undefined): Position | undefined {
    if (closeType) return undefined;

    const entryPrice: number = position.entryPrice;
    const currentPrice: number = kline.prices.close;
    const priceChange: number = this.calcPriceChange(entryPrice, currentPrice);

    if (position.size > 0) {  // long
      position.size = position.entrySize * (1 + priceChange);
      position.price = currentPrice;
    } else {  // short
      position.size = position.entrySize * (1 - priceChange);
      position.price = currentPrice;
    }

    return position;
  }

  private calcProfitChange(position: Position, kline: Kline, algorithm: Algorithm, closeType: CloseType | undefined): number {
    const lastPrice: number = position.price;
    const entryPrice: number = position.entryPrice;
    const entrySize: number = position.entrySize;
    const currentPrice: number = closeType ? this.getClosePrice(position, closeType, kline, algorithm) : kline.prices.close;
    const diff: number = currentPrice - lastPrice;
    const change: number = diff / entryPrice;
    const profitChange: number = change * entrySize * 100;
    return profitChange;
  }

  private getClosePrice(position: Position, closeType: CloseType, kline: Kline, algorithm: Algorithm): number {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    let currentPrice: number;

    switch (closeType) {
      case CloseType.Close:
        const closeSignal: BacktestSignal = backtest.signals.find((signal: BacktestSignal) => {
          return signal.signal === Signal.Close;
        })!;

        currentPrice = closeSignal.price;
        break;
      case CloseType.Liquidation: currentPrice = position.liquidationPrice; break;
      case CloseType.StopLoss: currentPrice = position.stopLossPrice!; break;
      case CloseType.TakeProfit: currentPrice = position.takeProfitPrice!; break;
    }

    return currentPrice;
  }

  private getCloseType(position: Position, kline: Kline, algorithm: Algorithm): CloseType | undefined {
    const size: number = position.size;
    const isForceClose: boolean = this.isForceClose(position, kline);
    const closeSignal: BacktestSignal | undefined = kline.algorithms[algorithm]?.signals.find((signal: BacktestSignal) => signal.signal === Signal.Close);
    if ((!isForceClose && !closeSignal) || size === 0) return undefined;

    const slPrice: number | undefined = position.stopLossPrice;
    const tpPrice: number | undefined = position.takeProfitPrice;
    const liquidationPrice: number = position.liquidationPrice;
    const isTpTrigger: boolean = this.isTakeProfitTrigger(position, kline);
    const isSlTrigger: boolean = this.isStopLossTrigger(position, kline);
    const isLiquidation: boolean = this.isLiquidation(position, kline);
    const forceCloseTypes: CloseType[] = []; // all triggered close types

    if (isSlTrigger) forceCloseTypes.push(CloseType.StopLoss);  // sl has precedence over liquidation because sl will always be triggered before liquidation
    if (isLiquidation) forceCloseTypes.push(CloseType.Liquidation); // liquidation has precedence over take profit because we calculate with max loss, max risk, since intra-kline we can't determine which came first
    if (isTpTrigger) forceCloseTypes.push(CloseType.TakeProfit);

    const forceCloseType: CloseType | undefined = forceCloseTypes[0]; // take the first type that was pushed, which will have precedence over the succeeding types

    if (!forceCloseType) return CloseType.Close;
    if (!closeSignal) return forceCloseType;

    if (forceCloseType && closeSignal) {
      const closePrice: number = closeSignal.price;
      let forceClosePrice: number;

      switch (forceCloseType) {
        case CloseType.StopLoss: forceClosePrice = slPrice!; break;
        case CloseType.Liquidation: forceClosePrice = liquidationPrice; break;
        case CloseType.TakeProfit: forceClosePrice = tpPrice!; break;
      }

      if (size > 0) { // long
        return closePrice < forceClosePrice! ? CloseType.Close : forceCloseType;  // again, take the price that would result in max loss, max risk
      } else {  // short
        return closePrice > forceClosePrice! ? CloseType.Close : forceCloseType;
      }
    }
  }

  // check if liquidation or close trigger
  private isForceClose(position: Position, kline: Kline): boolean {
    const isLiquidation: boolean = this.isLiquidation(position, kline);
    const isCloseTrigger: boolean = this.isCloseTrigger(position, kline);
    return isLiquidation || isCloseTrigger;
  }

  private isLiquidation(position: Position, kline: Kline): boolean {
    const size: number = position.size;
    const liquidationPrice: number = position.liquidationPrice;
    const currentHigh: number = kline.prices.high;
    const currentLow: number = kline.prices.low;

    if (size > 0) { // long
      return currentLow <= liquidationPrice; // for now, without leverage, long liquidation cannot be triggered (except weird cases like negative prices on oil, will not consider that)
    } else if (size < 0) {  //short
      return currentHigh >= liquidationPrice;
    } else {
      return false;
    }
  }

  private isCloseTrigger(position: Position, kline: Kline): boolean {
    const isTpSlTrigger: boolean = this.isTpSlTrigger(position, kline);
    return isTpSlTrigger;
  }

  private isTpSlTrigger(position: Position, kline: Kline): boolean {
    const isTpTrigger: boolean = this.isTakeProfitTrigger(position, kline);
    const isSlTrigger: boolean = this.isStopLossTrigger(position, kline);
    return isTpTrigger || isSlTrigger;
  }

  private isTakeProfitTrigger(position, kline: Kline): boolean {
    const takeProfitPrice: number | undefined = position.takeProfitPrice;
    if (!takeProfitPrice) return false;

    const size: number = position.size;
    const currentHigh: number = kline.prices.high;
    const currentLow: number = kline.prices.low;

    if (size > 0) { // long
      return takeProfitPrice !== undefined && takeProfitPrice > currentHigh;
    } else if (size < 0) {  // short
      return takeProfitPrice !== undefined && takeProfitPrice < currentLow;
    }

    return false;
  }

  private isStopLossTrigger(position, kline: Kline): boolean {
    const stopLossPrice: number | undefined = position.stopLossPrice;
    if (!stopLossPrice) return false;

    const size: number = position.size;
    const currentHigh: number = kline.prices.high;
    const currentLow: number = kline.prices.low;

    if (size > 0) { // long
      return stopLossPrice !== undefined && stopLossPrice < currentLow;
    } else if (size < 0) {  // short
      return stopLossPrice !== undefined && stopLossPrice > currentHigh;
    }

    return false;
  }
}