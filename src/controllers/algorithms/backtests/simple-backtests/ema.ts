import Indicators from '../../../technical-analysis/indicators';
import { Algorithm, BacktestData, BacktestSignal, Kline, Signal, Timeframe } from '../../../../interfaces';
import Base from '../../../../base';
import binance from '../../../exchanges/binance';
import Btse from '../../../exchanges/btse';

export default class Ema extends Base {
  private indicators = new Indicators();
  private btse = new Btse();
  private tradingPositionOpen = new Map();

  /**
   * sets position signals depending on emas going up or down
   */
  public setSignals(klines: Kline[], algorithm: Algorithm, periodOpen: number, periodClose: number): Kline[] {
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
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;
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
        signals.push({
          signal: Signal.Close,
          price: closePrice
        });

        positionOpen = false;
      }

      if (!positionOpen && momentumSwitchOpen) {
        if (moveOpen === 'up') {
          signals.push({
            signal: Signal.Close,
            price: closePrice
          });

          signals.push({
            signal: Signal.Buy,
            size: 1,
            price: closePrice
          });

          positionOpen = true;
        } else if (moveOpen === 'down') {
          signals.push({
            signal: Signal.Close,
            price: closePrice
          });

          signals.push({
            signal: Signal.Sell,
            size: 1,
            price: closePrice
          });

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

  /**
   * run live trading algorithm
   */
  public trade(symbol: string, alreadyOpen?: boolean) {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const timeDiffToNextHour = 60 * 60000 - (minutes * 60000 + seconds * 1000);

    const leverage = 50;
    const timeframe = Timeframe._1Hour;
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
  private async tradeInterval(symbol: string, timeframe: Timeframe, quantityUSD: number, leverage: number) {
    const klines = await binance.getKlines(symbol, timeframe);
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