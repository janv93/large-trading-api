import Indicators from '../../../technical-analysis/indicators';
import { Kline } from '../../../../interfaces';
import Base from '../../../base';
import Binance from '../../../exchanges/binance';
import Btse from '../../../exchanges/btse';

export default class Ema extends Base {
  private indicators = new Indicators();
  private binance = new Binance();
  private btse = new Btse();
  private tradingPositionOpen = new Map();

  /**
   * sets position signals depending on emas going up or down
   */
  public setSignals(klines: Kline[], algorithm: string, periodOpen: number, periodClose: number): Kline[] {
    const emaOpenFull = this.indicators.ema(klines, periodOpen);
    const emaCloseFull = this.indicators.ema(klines, periodClose);
    const maxLength = Math.min(emaOpenFull.length, emaCloseFull.length);
    const emaOpen = emaOpenFull.slice(-maxLength);
    const emaClose = emaCloseFull.slice(-maxLength);
    const klinesWithEma = klines.slice(-maxLength);

    let lastMoveOpen: string;
    let lastMoveClose: string;
    let lastEmaOpen: number;
    let lastEmaClose: number;
    let positionOpen = false;

    klinesWithEma.forEach((kline, i) => {
      const eOpen = emaOpen[i].ema;
      const eClose = emaClose[i].ema;

      // init

      if (i === 0) {
        lastEmaOpen = eOpen;
        lastEmaClose = eClose;
        return;
      }

      const moveOpen = eOpen - lastEmaOpen > 0 ? 'up' : 'down';
      const moveClose = eClose - lastEmaClose > 0 ? 'up' : 'down';

      if (i === 1) {
        lastMoveOpen = moveOpen;
        lastEmaOpen = eOpen;
        lastMoveClose = moveClose;
        lastEmaClose = eClose;
        return;
      }

      const momentumSwitchOpen = moveOpen !== lastMoveOpen;
      const momentumSwitchClose = moveClose !== lastMoveClose;

      // init end

      // set signals

      if (positionOpen && momentumSwitchClose && lastMoveOpen !== moveClose) {
        kline.algorithms[algorithm].signal = this.closeSignal;
        positionOpen = false;
      }

      if (!positionOpen && momentumSwitchOpen) {
        if (moveOpen === 'up') {
          kline.algorithms[algorithm].signal = this.closeBuySignal;
          positionOpen = true;
        } else if (moveOpen === 'down') {
          kline.algorithms[algorithm].signal = this.closeSellSignal;
          positionOpen = true;
        }
      }

      // set signals end

      lastMoveOpen = moveOpen;
      lastEmaOpen = eOpen;
      lastMoveClose = moveClose;
      lastEmaClose = eClose;
    });

    return klines;
  }

  public setSignalsSL(klines: Kline[], algorithm: string, period: number): Kline[] {
    const ema = this.indicators.ema(klines, period);
    const klinesWithEma = klines.slice(-ema.length);

    let lastMove: string;
    let positionOpen = false;
    let lastEma: number;
    let lastSignal: string;
    let posOpenPrice: number;
    const stopLossPercent = 0.0;

    klinesWithEma.forEach((kline, index) => {
      const e = ema[index].ema;

      if (!lastEma) {
        lastEma = e;
        return;
      }

      const move = e - lastEma > 0 ? 'up' : 'down';

      if (!lastMove) {
        lastMove = move;
        lastEma = e;
        return;
      }

      const momentumSwitch = move !== lastMove;

      if (!positionOpen && momentumSwitch) {
        posOpenPrice = kline.prices.close;

        if (move === 'up') {
          kline.algorithms[algorithm].signal = this.closeBuySignal;
          positionOpen = true;
        } else {
          kline.algorithms[algorithm].signal = this.closeSellSignal;
          positionOpen = true;
        }

        lastSignal = kline.algorithms[algorithm].signal;
      } else if (positionOpen) {
        if (momentumSwitch) {
          posOpenPrice = kline.prices.close;

          if (move === 'up') {
            kline.algorithms[algorithm].signal = this.closeBuySignal;
          } else {
            kline.algorithms[algorithm].signal = this.closeSellSignal;
          }
        } else {
          const currentPrice = kline.prices.close;
          const priceDiff = currentPrice - posOpenPrice;
          const priceDiffPercent = priceDiff / posOpenPrice;

          if (lastSignal === this.closeBuySignal) {
            const stopLossReached = priceDiffPercent < -stopLossPercent;

            if (stopLossReached) {
              kline.algorithms[algorithm].signal = this.closeSignal;
              positionOpen = false;
            }
          } else {
            const stopLossReached = priceDiffPercent > stopLossPercent;

            if (stopLossReached) {
              kline.algorithms[algorithm].signal = this.closeSignal;
              positionOpen = false;
            }
          }
        }
      }

      lastMove = move;
      lastEma = e;
    });

    return klines;
  }

  /**
   * run live trading algorithm
   */
  public trade(symbol: string, alreadyOpen?: boolean) {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const timeDiffToNextHour = 60 * 60000 - (minutes * 60000 + seconds * 1000);

    const leverage = 50;
    const timeframe = '1h';
    const quantityUSD = 2500;
    this.tradingPositionOpen.set(symbol, alreadyOpen);

    console.log(symbol + ' live trading started')

    setTimeout(() => {  // wait for full hour
      this.tradeInterval(symbol, timeframe, quantityUSD, leverage);
      setInterval(() => { // run every hour
        this.tradeInterval(symbol, timeframe, quantityUSD, leverage);
      }, 60 * 60000);
    }, timeDiffToNextHour + 10000);

  }

  /**
   * run trading algorithm in selected interval
   */
  private async tradeInterval(symbol: string, timeframe: string, quantityUSD: number, leverage: number) {
    const klines = await this.binance.getKlines(symbol, timeframe);
    const cryptoQuantity = Number((quantityUSD / klines[klines.length - 1].prices.close)/** .toFixed(2) for binance */);
    klines.splice(-1);  // remove running timeframe
    console.log(klines.slice(-3))
    const ema = this.indicators.ema(klines, 80);
    console.log(ema.slice(-3))
  
    const move = ema[ema.length - 1].ema - ema[ema.length - 2].ema > 0 ? 'up' : 'down';
    const lastMove = ema[ema.length - 2].ema - ema[ema.length - 3].ema > 0 ? 'up' : 'down';
    console.log(lastMove);
    console.log(move);
  
    const momentumSwitch = move !== lastMove;
  
    if (!this.tradingPositionOpen.get(symbol)) {
      if (momentumSwitch) {
        if (move === 'up') {
          await this.openLong(symbol, cryptoQuantity, leverage);
        } else {
          await this.openShort(symbol, cryptoQuantity, leverage);
        }
      }
    } else {
      if (momentumSwitch) {
        if (move === 'up') {
          await this.closeShortOpenLong(symbol, cryptoQuantity, leverage);
        } else {
          await this.closeLongOpenShort(symbol, cryptoQuantity, leverage);
        }
      }
    }
  }
  
  private async openLong(symbol: string, cryptoQuantity: number, leverage: number) {
    try {
      await this.btse.long(symbol, cryptoQuantity, leverage);
      this.tradingPositionOpen.set(symbol, true);
    } catch (err) {
      this.handleError(err);
    }
  }
  
  private async openShort(symbol: string, cryptoQuantity: number, leverage: number) {
    try {
      await this.btse.short(symbol, cryptoQuantity, leverage);
      this.tradingPositionOpen.set(symbol, true);
    } catch (err) {
      this.handleError(err);
    }
  }
  
  private async closeShortOpenLong(symbol: string, cryptoQuantity: number, leverage: number) {
    try {
      await this.btse.closeOrder(symbol);
      await this.btse.long(symbol, cryptoQuantity, leverage);
    } catch (err) {
      this.handleError(err);
    }
  }
  
  private async closeLongOpenShort(symbol: string, cryptoQuantity: number, leverage: number) {
    try {
      await this.btse.closeOrder(symbol);
      await this.btse.short(symbol, cryptoQuantity, leverage);
    } catch (err) {
      this.handleError(err);
    }
  }
  
}