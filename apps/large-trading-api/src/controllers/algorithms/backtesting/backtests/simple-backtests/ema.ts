import Indicators from '../../../patterns/indicators';
import { Algorithm, BacktestData, BacktestSignal, Kline, Signal, Timeframe } from '@shared';
import binance from '../../../../exchanges/binance';
import Btse from '../../../../exchanges/btse';
import Base from '../../../../../base';

export default class Ema extends Base {
  private indicators = new Indicators();
  private btse = new Btse();
  private tradingPositionOpen = new Map();

  /**
   * sets position signals depending on emas going up or down
   */
  public setSignals(klines: Kline[], algorithm: Algorithm, params: any): void {
    const periodOpen = Number(params.periodOpen);
    const periodClose = Number(params.periodClose);
    this.indicators.ema(klines, periodOpen);
    this.indicators.ema(klines, periodClose);
    const klinesWithEma = klines.filter(k => k.indicators?.ema?.[periodOpen] !== undefined && k.indicators?.ema?.[periodClose] !== undefined);

    let lastMoveOpen: string;
    let lastMoveClose: string;
    let lastEmaOpen: number;
    let lastEmaClose: number;
    let positionOpen = false;

    klinesWithEma.forEach((kline, i) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;
      const eOpen = kline.indicators!.ema![periodOpen];
      const eClose = kline.indicators!.ema![periodClose];

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
          signal: Signal.CloseAll,
          price: closePrice
        });

        positionOpen = false;
      }

      if (!positionOpen && momentumSwitchOpen) {
        if (moveOpen === 'up') {
          signals.push({
            signal: Signal.CloseAll,
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
            signal: Signal.CloseAll,
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
    const emaPeriod = 80;
    this.indicators.ema(klines, emaPeriod);
    const klinesWithEma = klines.filter(k => k.indicators?.ema?.[emaPeriod] !== undefined);
    console.log(klinesWithEma.slice(-3))

    const move = klinesWithEma[klinesWithEma.length - 1].indicators!.ema![emaPeriod] - klinesWithEma[klinesWithEma.length - 2].indicators!.ema![emaPeriod] > 0 ? 'up' : 'down';
    const lastMove = klinesWithEma[klinesWithEma.length - 2].indicators!.ema![emaPeriod] - klinesWithEma[klinesWithEma.length - 3].indicators!.ema![emaPeriod] > 0 ? 'up' : 'down';
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