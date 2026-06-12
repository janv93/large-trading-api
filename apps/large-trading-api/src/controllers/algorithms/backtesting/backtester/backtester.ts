import { Algorithm, BacktestData, BacktestSignal, Bar, Position, Signal, SignalReference, TakeProfitStopLoss, TrailingStopLoss } from '@shared';
import Base from '../../../../base';
import { isCloseSignal, isForceCloseSignal, calcPriceChange } from '@shared';

export default class Backtester extends Base {
  /**
   * @param bars the bars returned from /barsWithAlgorithm
   * @param commission commission of exchange, e.g. 0.0004 = 0.04%
   * @returns the bars with profits
   */
  public calcBacktestPerformance(bars: Bar[], algorithm: Algorithm, commission: number): Bar[] {
    let positions: Array<Position | undefined> = [];
    let profit = 0;
    let volatility: number = 0;

    this.forEachWithProgress(bars, (bar: Bar, index: number) => {
      positions = (positions as Position[]).map((position: Position) => {
        const closeSignal: Signal | undefined = this.getCloseSignal(position, bar, algorithm);
        profit += this.calcProfitChange(position, bar, algorithm, closeSignal);

        if (closeSignal) {
          this.addOrUpdateCloseSignal(position, bar, algorithm, closeSignal);
          profit -= this.calcCloseFee(position, bar, algorithm, closeSignal, commission);
          return undefined;
        } else {
          return this.updateExistingPosition(position, bar, bars, algorithm);
        }
      });

      positions = positions.filter((position: Position | undefined) => position !== undefined); // filter out all closed positions
      this.addNewPositions(positions as Position[], bar, algorithm, index, volatility);  // create new positions from signals
      profit -= this.calcOpenFee(bar, algorithm, commission);
      const backtest: BacktestData = bar.algorithms[algorithm]!;
      backtest.profit = profit;
      backtest.openPositionSize = this.calcPositionSize(positions as Position[]);
      volatility = this.calcVolatility(bars, index);  // update after bar is complete, used for next bar's positions
    });

    return bars;
  }

  private getCloseSignal(position: Position, bar: Bar, algorithm: Algorithm): Signal | undefined {
    const size: number = position.size;
    const isForceClose: boolean = this.isForceClose(position, bar);
    const closeBacktestSignal: BacktestSignal | undefined = this.findCloseBacktestSignal(position, bar, algorithm);
    const closeSignal: Signal | undefined = closeBacktestSignal?.signal;

    if ((!isForceClose && !closeBacktestSignal) || size === 0) return undefined;

    const slPrice: number | undefined = position.stopLossPrice;
    const tpPrice: number | undefined = position.takeProfitPrice;
    const liquidationPrice: number = position.liquidationPrice;
    const isTpTrigger: boolean = this.isTakeProfitTrigger(position, bar);
    const isSlTrigger: boolean = this.isStopLossTrigger(position, bar);
    const isLiquidation: boolean = this.isLiquidation(position, bar);
    const forceCloseSignals: Signal[] = []; // all triggered close signals

    if (isSlTrigger) forceCloseSignals.push(Signal.StopLoss);  // sl has precedence over liquidation because sl will always be triggered before liquidation
    if (isLiquidation) forceCloseSignals.push(Signal.Liquidation); // liquidation has precedence over take profit because we calculate with max loss, max risk, since intra-bar we can't determine which came first
    if (isTpTrigger) forceCloseSignals.push(Signal.TakeProfit);

    const forceCloseSignal: Signal | undefined = forceCloseSignals[0]; // take the first signal that was pushed, which will have precedence over the succeeding types

    if (!forceCloseSignal) return closeSignal;
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
        return closePrice < forceClosePrice! ? closeSignal : forceCloseSignal;  // again, take the price that would result in max loss, max risk
      } else {  // short
        return closePrice > forceClosePrice! ? closeSignal : forceCloseSignal;
      }
    }
  }

  private findCloseBacktestSignal(position: Position, bar: Bar, algorithm: Algorithm): BacktestSignal | undefined {
    return bar.algorithms[algorithm]?.signals.find((signal: BacktestSignal) => {
      if (signal.signal === Signal.CloseAll) {
        return true;
      } else if (signal.signal === Signal.Close) {
        return signal.openSignalReferences!.some((signalReference: SignalReference) => {
          return signalReference.barIndex === position.openSignalReference.barIndex
            && signalReference.signalIndex === position.openSignalReference.signalIndex;
        });
      }
    });
  }

  private calcProfitChange(position: Position, bar: Bar, algorithm: Algorithm, closeSignal: Signal | undefined): number {
    const lastPrice: number = position.price;
    const entryPrice: number = position.entryPrice;
    const entrySize: number = position.entrySize;
    const currentPrice: number = closeSignal ? this.getClosePrice(position, closeSignal, bar, algorithm) : bar.prices.close;
    const diff: number = currentPrice - lastPrice;
    const change: number = diff / entryPrice;
    const profitChange: number = change * entrySize;
    return profitChange;
  }

  private addOrUpdateCloseSignal(position: Position, bar: Bar, algorithm: Algorithm, closeSignal: Signal) {
    const signals: BacktestSignal[] = bar.algorithms[algorithm]!.signals;
    const signalReference: SignalReference = position.openSignalReference;

    if (isForceCloseSignal(closeSignal)) { // add force close to bar signals
      const closePrice: number = this.getClosePrice(position, closeSignal!, bar, algorithm);
      signals.push({ signal: closeSignal!, price: closePrice, openSignalReferences: [signalReference] });
    } else if (closeSignal === Signal.CloseAll) {  // add reference of all positions that are closed by this signal - this is mainly for completeness and the frontend using this reference
      const closeAllBacktestSignal: BacktestSignal = signals.find((signal: BacktestSignal) => signal.signal === Signal.CloseAll)!;

      if (closeAllBacktestSignal.openSignalReferences?.length) {
        closeAllBacktestSignal.openSignalReferences.push(signalReference);
      } else {
        closeAllBacktestSignal.openSignalReferences = [signalReference];
      }
    }
  }

  private calcCloseFee(position: Position, bar: Bar, algorithm: Algorithm, closeSignal: Signal, commission: number): number {
    if (closeSignal === Signal.Liquidation) {
      return 0;
    } else {
      // first determine at which price the position was closed
      const entryPrice: number = position.entryPrice;
      const entrySize: number = position.entrySize;
      const currentSize: number = position.size;
      const currentPrice: number = this.getClosePrice(position, closeSignal, bar, algorithm);
      const priceChange: number = calcPriceChange(entryPrice, currentPrice!);
      // then determine the size of the position at close
      const sizeAtClose: number = currentSize > 0 ? entrySize * (1 + priceChange) : entrySize * (1 - priceChange);
      // then calculate commission on the final size
      const fee: number = commission * Math.abs(sizeAtClose);
      return fee;
    }
  }

  // update size and price of existing position in case it was not closed
  private updateExistingPosition(position: Position, bar: Bar, bars: Bar[], algorithm: Algorithm): Position {
    const entryPrice: number = position.entryPrice;
    const currentClose: number = bar.prices.close;
    const currentHigh: number = bar.prices.high;
    const currentLow: number = bar.prices.low;
    const priceChange: number = calcPriceChange(entryPrice, currentClose);

    if (position.size > 0) {  // long
      position.size = position.entrySize * (1 + priceChange);
    } else {  // short
      position.size = position.entrySize * (1 - priceChange);
    }

    position.price = currentClose;
    position.highestPrice = Math.max(position.highestPrice || 0, currentHigh);
    position.lowestPrice = Math.min(position.lowestPrice || Infinity, currentLow);
    this.updateExistingPositionTrailingStopLoss(position, bars, algorithm);
    return position;
  }

  private updateExistingPositionTrailingStopLoss(position: Position, bars: Bar[], algorithm: Algorithm) {
    const openSignal: BacktestSignal = bars[position.openSignalReference.barIndex].algorithms[algorithm]!.signals[position.openSignalReference.signalIndex];
    const trailingStopLoss: TrailingStopLoss | undefined = openSignal.positionCloseTrigger?.tSl;

    if (trailingStopLoss) {
      const baseStopLoss: number = trailingStopLoss.stopLoss;
      const percentOfProfit: number | undefined = trailingStopLoss.percentOfProfit;

      if (position.size > 0) {  // long
        const baseSLPrice: number = position.highestPrice! * (1 - baseStopLoss);
        let newStopLossPrice: number = baseSLPrice;

        if (percentOfProfit != null) {
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

        if (percentOfProfit != null) {
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

  private addNewPositions(positions: Position[], bar: Bar, algorithm: Algorithm, barIndex: number, volatility: number) {
    const backtest: BacktestData = bar.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;

    signals.forEach((signal: BacktestSignal, signalIndex: number) => {
      if (!isCloseSignal(signal.signal)) {
        positions.push(this.createPosition(signal, barIndex, signalIndex, volatility));
      }
    });
  }

  private calcOpenFee(bar: Bar, algorithm: Algorithm, commission: number): number {
    let totalOpenFee = 0;
    const backtest: BacktestData = bar.algorithms[algorithm]!;
    const signals: BacktestSignal[] = backtest.signals;

    signals.forEach((signal: BacktestSignal) => {
      if (!isCloseSignal(signal.signal)) {
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

  private calcVolatility(bars: Bar[], barIndex: number): number {
    const period = 14;
    const start: number = Math.max(1, barIndex - period + 1);
    let atrSum: number = 0;
    let count: number = 0;

    for (let i = start; i <= barIndex; i++) {
      const high: number = bars[i].prices.high;
      const low: number = bars[i].prices.low;
      const prevClose: number = bars[i - 1].prices.close;
      atrSum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      count++;
    }

    const atr: number = count > 0 ? atrSum / count : 0;
    return atr / bars[barIndex].prices.close;  // normalized ATR as fraction of price
  }

  private createPosition(signal: BacktestSignal, barIndex: number, signalIndex: number, volatility: number): Position {
    const signalSize: number = signal.size!;
    const signalPrice: number = signal.price;
    const tpSl: TakeProfitStopLoss | undefined = signal.positionCloseTrigger?.tpSl;
    const tSl: TrailingStopLoss | undefined = signal.positionCloseTrigger?.tSl;

    const { takeProfit, stopLoss } = this.resolveTpSl(tpSl, tSl, volatility);

    this.assertParam({ takeProfit });
    this.assertParam({ stopLoss });
    this.assertParam({ percentOfProfit: tSl?.percentOfProfit });
    const openSignalReference: SignalReference = { barIndex, signalIndex };
    let size: number;
    let entrySize: number;
    let liquidationPrice: number;
    let takeProfitPrice: number | undefined;
    let stopLossPrice: number | undefined;

    if (signal.signal === Signal.Buy) {
      size = signalSize;
      entrySize = signalSize;
      liquidationPrice = 0;
      takeProfitPrice = this.calcTakeProfitPrice(signalPrice, takeProfit, signal.signal);
      stopLossPrice = this.calcStopLossPrice(signalPrice, stopLoss, signal.signal);
    } else if (signal.signal === Signal.Sell) {
      size = -signalSize;
      entrySize = -signalSize;
      liquidationPrice = signalPrice * 2;
      takeProfitPrice = this.calcTakeProfitPrice(signalPrice, takeProfit, signal.signal);
      stopLossPrice = this.calcStopLossPrice(signalPrice, stopLoss, signal.signal);
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

  private getClosePrice(position: Position, closeSignal: Signal, bar: Bar, algorithm: Algorithm): number {
    let currentPrice: number;

    switch (closeSignal) {
      case Signal.Close:
      case Signal.CloseAll:
        currentPrice = this.findCloseBacktestSignal(position, bar, algorithm)!.price;
        break;
      case Signal.Liquidation: currentPrice = position.liquidationPrice; break;
      case Signal.StopLoss: currentPrice = position.stopLossPrice!; break;
      case Signal.TakeProfit: currentPrice = position.takeProfitPrice!; break;
    }

    return currentPrice!;
  }

  // check if liquidation or close trigger
  private isForceClose(position: Position, bar: Bar): boolean {
    const isLiquidation: boolean = this.isLiquidation(position, bar);
    const isCloseTrigger: boolean = this.isCloseTrigger(position, bar);
    return isLiquidation || isCloseTrigger;
  }

  private isLiquidation(position: Position, bar: Bar): boolean {
    const size: number = position.size;
    const liquidationPrice: number = position.liquidationPrice;
    const currentHigh: number = bar.prices.high;
    const currentLow: number = bar.prices.low;

    if (size > 0) { // long
      return currentLow <= liquidationPrice; // for now, without leverage, long liquidation cannot be triggered (except weird cases like negative prices on oil, will not consider that)
    } else if (size < 0) {  //short
      return currentHigh >= liquidationPrice;
    } else {
      return false;
    }
  }

  private isCloseTrigger(position: Position, bar: Bar): boolean {
    const isTpSlTrigger: boolean = this.isTpSlTrigger(position, bar);
    return isTpSlTrigger;
  }

  private isTpSlTrigger(position: Position, bar: Bar): boolean {
    const isTpTrigger: boolean = this.isTakeProfitTrigger(position, bar);
    const isSlTrigger: boolean = this.isStopLossTrigger(position, bar);
    return isTpTrigger || isSlTrigger;
  }

  private isTakeProfitTrigger(position: Position, bar: Bar): boolean {
    const takeProfitPrice: number | undefined = position.takeProfitPrice;
    if (!takeProfitPrice) return false;

    const size: number = position.size;
    const currentHigh: number = bar.prices.high;
    const currentLow: number = bar.prices.low;

    if (size > 0) { // long
      return takeProfitPrice !== undefined && currentHigh > takeProfitPrice;
    } else if (size < 0) {  // short
      return takeProfitPrice !== undefined && currentLow < takeProfitPrice;
    }

    return false;
  }

  private isStopLossTrigger(position: Position, bar: Bar): boolean {
    const stopLossPrice: number | undefined = position.stopLossPrice;
    if (!stopLossPrice) return false;

    const size: number = position.size;
    const currentHigh: number = bar.prices.high;
    const currentLow: number = bar.prices.low;

    if (size > 0) { // long
      return stopLossPrice !== undefined && currentLow < stopLossPrice;
    } else if (size < 0) {  // short
      return stopLossPrice !== undefined && currentHigh > stopLossPrice;
    }

    return false;
  }

  private resolveTpSl(tpSl: TakeProfitStopLoss | undefined, tSl: TrailingStopLoss | undefined, volatility: number): { takeProfit: number | undefined, stopLoss: number | undefined } {
    if (tpSl?.asVolatilityFactor) {
      return { takeProfit: tpSl.takeProfit * volatility, stopLoss: tpSl.stopLoss * volatility };
    } else if (tpSl) {
      return { takeProfit: tpSl.takeProfit, stopLoss: tpSl.stopLoss };
    } else if (tSl) {
      return { takeProfit: undefined, stopLoss: tSl.stopLoss };
    }
    return { takeProfit: undefined, stopLoss: undefined };
  }

  private calcTakeProfitPrice(entryPrice: number, takeProfit: number | undefined, signal: Signal.Buy | Signal.Sell): number | undefined {
    if (takeProfit === undefined) return undefined;
    return signal === Signal.Buy ? entryPrice * (1 + takeProfit) : entryPrice * (1 - takeProfit);
  }

  private calcStopLossPrice(entryPrice: number, stopLoss: number | undefined, signal: Signal.Buy | Signal.Sell): number | undefined {
    if (stopLoss === undefined) return undefined;
    return signal === Signal.Buy ? entryPrice * (1 - stopLoss) : entryPrice * (1 + stopLoss);
  }

  private assertParam(param: Record<string, number | undefined>): void {
    const [name, value] = Object.entries(param)[0];
    if (value !== undefined && isNaN(value)) throw new Error(`${name} is NaN`);
  }
}