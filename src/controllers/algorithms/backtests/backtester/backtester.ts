import { Algorithm, BacktestData, BacktestSignal, Kline, Position, Signal, SignalReference, TakeProfitStopLoss, TrailingStopLoss } from '../../../../interfaces';
import Base from '../../../../base';

export default class Backtester extends Base {
  /**
   * @param klines the klines returned from /klinesWithAlgorithm
   * @param commission commission of exchange, e.g. 0.04 = 0.04%
   * @returns the klines with profits
   */
  public calcBacktestPerformance(klines: Kline[], algorithm: Algorithm, commission: number): Kline[] {
    let positions: Array<Position | undefined> = [];
    let profit = 0;

    this.forEachWithProgress(klines, (kline: Kline) => {
      positions = (positions as Position[]).map((position: Position) => {
        const closeSignal: Signal | undefined = this.getCloseSignal(position, kline, algorithm);
        profit += this.calcProfitChange(position, kline, algorithm, closeSignal);

        if (closeSignal) {
          this.addOrUpdateCloseSignal(position, kline, algorithm, closeSignal);
          profit -= this.calcCloseFee(position, kline, algorithm, closeSignal, commission);
          return undefined;
        } else {
          return this.updateExistingPosition(position, kline);
        }
      });

      positions = positions.filter((position: Position | undefined) => position !== undefined); // filter out all closed positions
      this.addNewPositions(positions as Position[], kline, algorithm);  // create new positions from signals
      profit -= this.calcOpenFee(kline, algorithm, commission);
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      backtest.percentProfit = profit;
      backtest.openPositionSize = this.calcPositionSize(positions as Position[]);
    });

    return klines;
  }

  private getCloseSignal(position: Position, kline: Kline, algorithm: Algorithm): Signal | undefined {
    const size: number = position.size;
    const isForceClose: boolean = this.isForceClose(position, kline);
    const closeBacktestSignal: BacktestSignal | undefined = kline.algorithms[algorithm]?.signals.find((signal: BacktestSignal) => signal.signal === Signal.Close);
    if ((!isForceClose && !closeBacktestSignal) || size === 0) return undefined;

    const slPrice: number | undefined = position.stopLossPrice;
    const tpPrice: number | undefined = position.takeProfitPrice;
    const liquidationPrice: number = position.liquidationPrice;
    const isTpTrigger: boolean = this.isTakeProfitTrigger(position, kline);
    const isSlTrigger: boolean = this.isStopLossTrigger(position, kline);
    const isLiquidation: boolean = this.isLiquidation(position, kline);
    const forceCloseSignals: Signal[] = []; // all triggered close signals

    if (isSlTrigger) forceCloseSignals.push(Signal.StopLoss);  // sl has precedence over liquidation because sl will always be triggered before liquidation
    if (isLiquidation) forceCloseSignals.push(Signal.Liquidation); // liquidation has precedence over take profit because we calculate with max loss, max risk, since intra-kline we can't determine which came first
    if (isTpTrigger) forceCloseSignals.push(Signal.TakeProfit);

    const forceCloseSignal: Signal | undefined = forceCloseSignals[0]; // take the first signal that was pushed, which will have precedence over the succeeding types

    if (!forceCloseSignal) return Signal.Close;
    if (!closeBacktestSignal) return forceCloseSignal;

    if (forceCloseSignal && closeBacktestSignal) {
      const closePrice: number = closeBacktestSignal.price;
      let forceClosePrice: number;

      switch (forceCloseSignal) {
        case Signal.StopLoss: forceClosePrice = slPrice!; break;
        case Signal.Liquidation: forceClosePrice = liquidationPrice; break;
        case Signal.TakeProfit: forceClosePrice = tpPrice!; break;
      }

      if (size > 0) { // long
        return closePrice < forceClosePrice! ? Signal.Close : forceCloseSignal;  // again, take the price that would result in max loss, max risk
      } else {  // short
        return closePrice > forceClosePrice! ? Signal.Close : forceCloseSignal;
      }
    }
  }

  private calcProfitChange(position: Position, kline: Kline, algorithm: Algorithm, closeSignal: Signal | undefined): number {
    const lastPrice: number = position.price;
    const entryPrice: number = position.entryPrice;
    const entrySize: number = position.entrySize;
    const currentPrice: number = closeSignal ? this.getClosePrice(position, closeSignal, kline, algorithm) : kline.prices.close;
    const diff: number = currentPrice - lastPrice;
    const change: number = diff / entryPrice;
    const profitChange: number = change * entrySize * 100;
    return profitChange;
  }

  private addOrUpdateCloseSignal(position: Position, kline: Kline, algorithm: Algorithm, closeSignal: Signal) {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const backtestSignals: BacktestSignal[] = backtest.signals;
    const signalReference: SignalReference = position.openSignalReference;

    if (this.isForceCloseSignal(closeSignal)) { // add force close to kline signals
      const closePrice: number = this.getClosePrice(position, closeSignal!, kline, algorithm);
      backtestSignals.push({ signal: closeSignal!, price: closePrice, openSignalReferences: [signalReference] });
    } else {  // normal close signal
      const closeBacktestSignal: BacktestSignal = backtest.signals.find((signal: BacktestSignal) => signal.signal === Signal.Close)!;

      if (closeBacktestSignal.openSignalReferences?.length) {
        closeBacktestSignal.openSignalReferences.push(signalReference);
      } else {
        closeBacktestSignal.openSignalReferences = [signalReference];
      }
    }
  }

  private calcCloseFee(position: Position, kline: Kline, algorithm: Algorithm, closeSignal: Signal, commission: number): number {
    if (closeSignal === Signal.Liquidation) {
      // in case of liquidation, you don't pay a fee.
      // e.g. when normally closing a position that is worth 50$ from an orignal 100$, you pay the commission * 50$
      // now when the position is worth 0$ from an original 100$, you pay 0 commission
      return 0;
    } else {
      // first determine at which price the position was closed
      const entryPrice: number = position.entryPrice;
      const entrySize: number = position.entrySize;
      const currentSize: number = position.size;
      const currentPrice: number = this.getClosePrice(position, closeSignal, kline, algorithm);
      const priceChange: number = this.calcPriceChange(entryPrice, currentPrice!);
      // then determine the size of the position at close
      const sizeAtClose: number = currentSize > 0 ? entrySize * (1 + priceChange) : entrySize * (1 - priceChange);
      // then calculate commission on the final size
      const fee: number = commission * Math.abs(sizeAtClose);
      return fee;
    }
  }

  // update size and price of existing position in case it was not closed
  private updateExistingPosition(position: Position, kline: Kline): Position {
    const entryPrice: number = position.entryPrice;
    const currentClose: number = kline.prices.close;
    const currentHigh: number = kline.prices.high;
    const currentLow: number = kline.prices.low;
    const priceChange: number = this.calcPriceChange(entryPrice, currentClose);

    if (position.size > 0) {  // long
      position.size = position.entrySize * (1 + priceChange);
    } else {  // short
      position.size = position.entrySize * (1 - priceChange);
    }

    position.price = currentClose;
    position.highestPrice = Math.max(position.highestPrice || 0, currentHigh);
    position.lowestPrice = Math.min(position.lowestPrice || Infinity, currentLow);
    this.updateExistingPositionTrailingStopLoss(position);
    return position;
  }

  private updateExistingPositionTrailingStopLoss(position: Position) {
    const trailingStopLoss: TrailingStopLoss | undefined = position.openSignalReference.signal.positionCloseTrigger?.tSl;

    if (trailingStopLoss) {
      const baseStopLoss: number = trailingStopLoss.stopLoss;
      const percentOfProfit: number | undefined = trailingStopLoss.percentOfProfit;

      if (position.size > 0) {  // long
        const baseSLPrice: number = position.highestPrice! * (1 - baseStopLoss);
        let newStopLossPrice: number = baseSLPrice;

        if (percentOfProfit) {
          const absoluteProfit = position.highestPrice! - position.entryPrice;
          const profitToKeep = absoluteProfit * percentOfProfit;
          const percentOfProfitSLPrice = position.entryPrice + profitToKeep;
          newStopLossPrice = Math.min(baseSLPrice, percentOfProfitSLPrice);
        }

        if (newStopLossPrice > position.stopLossPrice!) {
          position.stopLossPrice = newStopLossPrice;
        }
      } else {  // short
        const baseSLPrice: number = position.lowestPrice! * (1 + baseStopLoss);
        let newStopLossPrice: number = baseSLPrice;

        if (percentOfProfit) {
          const absoluteProfit = position.entryPrice - position.lowestPrice!;
          const profitToKeep = absoluteProfit * percentOfProfit;
          const percentOfProfitSLPrice = position.lowestPrice! + profitToKeep;
          newStopLossPrice = Math.max(baseSLPrice, percentOfProfitSLPrice);
        }

        if (newStopLossPrice < position.stopLossPrice!) {
          position.stopLossPrice = newStopLossPrice;
        }
      }
    }
  }

  private addNewPositions(positions: Position[], kline: Kline, algorithm: Algorithm) {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;

    signals.forEach((signal: BacktestSignal) => {
      if (!this.isCloseSignal(signal.signal)) {
        positions.push(this.createPosition(kline, signal));
      }
    });
  }

  private calcOpenFee(kline: Kline, algorithm: Algorithm, commission: number): number {
    let totalOpenFee = 0;
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;

    signals.forEach((signal: BacktestSignal) => {
      if (!this.isCloseSignal(signal.signal)) {
        totalOpenFee += commission * signal.size!
      }
    });

    return totalOpenFee;
  }

  private calcPositionSize(positions: Position[]): number {
    return positions.reduce((acc: number, position: Position) => {
      return acc + position.size;
    }, 0);
  }

  private createPosition(kline: Kline, signal: BacktestSignal): Position {
    const signalSize: number = signal.size!;
    const signalPrice: number = signal.price;
    const tpSl: TakeProfitStopLoss | undefined = signal.positionCloseTrigger?.tpSl;
    const tSl: TrailingStopLoss | undefined = signal.positionCloseTrigger?.tSl;
    const takeProfit: number | undefined = tpSl?.takeProfit;
    const stopLoss: number | undefined = tpSl?.stopLoss || tSl?.stopLoss;
    const openSignalReference: SignalReference = { openTime: kline.times.open, signal };
    let size: number;
    let entrySize: number;
    let liquidationPrice: number;
    let takeProfitPrice: number | undefined;
    let stopLossPrice: number | undefined;

    if (signal.signal === Signal.Buy) {
      size = signalSize;
      entrySize = signalSize;
      liquidationPrice = 0;

      if (takeProfit) {
        takeProfitPrice = signalPrice * (1 + takeProfit);
      }

      if (stopLoss) {
        stopLossPrice = signalPrice * (1 - stopLoss);
      }
    } else if (signal.signal === Signal.Sell) {
      size = -signalSize;
      entrySize = -signalSize;
      liquidationPrice = signalPrice * 2;

      if (takeProfit) {
        takeProfitPrice = signalPrice * (1 - takeProfit);
      }

      if (stopLoss) {
        stopLossPrice = signalPrice * (1 + stopLoss);
      }
    }

    return {
      size: size!,
      entrySize: entrySize!,
      price: signalPrice,
      entryPrice: signalPrice,
      liquidationPrice: liquidationPrice!,
      takeProfitPrice,
      stopLossPrice,
      openSignalReference
    };
  }

  private getClosePrice(position: Position, closeSignal: Signal, kline: Kline, algorithm: Algorithm): number {
    const backtest: BacktestData = kline.algorithms[algorithm]!;
    let currentPrice: number;

    switch (closeSignal) {
      case Signal.Close:
        const closeBacktestSignal: BacktestSignal = backtest.signals.find((signal: BacktestSignal) => signal.signal === Signal.Close)!;
        currentPrice = closeBacktestSignal.price;
        break;
      case Signal.Liquidation: currentPrice = position.liquidationPrice; break;
      case Signal.StopLoss: currentPrice = position.stopLossPrice!; break;
      case Signal.TakeProfit: currentPrice = position.takeProfitPrice!; break;
    }

    return currentPrice!;
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
      return takeProfitPrice !== undefined && currentHigh > takeProfitPrice;
    } else if (size < 0) {  // short
      return takeProfitPrice !== undefined && currentLow < takeProfitPrice;
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
      return stopLossPrice !== undefined && currentLow < stopLossPrice;
    } else if (size < 0) {  // short
      return stopLossPrice !== undefined && currentHigh > stopLossPrice;
    }

    return false;
  }
}