import IndicatorsController from '../technical-analysis/indicators-controller';
import { Kline } from '../../interfaces';
import BaseController from '../base-controller';
import BinanceController from '../exchanges/binance-controller';
import BtseController from '../exchanges/btse-controller';

export default class EmaController extends BaseController {
  private indicatorsController = new IndicatorsController();
  private binanceController = new BinanceController();
  private btseController = new BtseController();
  private tradingPositionOpen = new Map();

  /**
   * sets position signals depending on emas going up or down
   */
  public setSignals(klines: Array<Kline>, periodOpen: number, periodClose: number): Array<Kline> {
    const emaOpenFull = this.indicatorsController.ema(klines, periodOpen);
    const emaCloseFull = this.indicatorsController.ema(klines, periodClose);
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
        kline.signal = this.closeSignal;
        positionOpen = false;
      }

      if (!positionOpen && momentumSwitchOpen) {
        if (moveOpen === 'up') {
          kline.signal = this.closeBuySignal;
          positionOpen = true;
        } else if (moveOpen === 'down') {
          kline.signal = this.closeSellSignal;
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

  public setSignalsSL(klines: Array<Kline>, period: number): Array<Kline> {
    const ema = this.indicatorsController.ema(klines, period);
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
          kline.signal = this.closeBuySignal;
          positionOpen = true;
        } else {
          kline.signal = this.closeSellSignal;
          positionOpen = true;
        }

        lastSignal = kline.signal;
      } else if (positionOpen) {
        if (momentumSwitch) {
          posOpenPrice = kline.prices.close;

          if (move === 'up') {
            kline.signal = this.closeBuySignal;
          } else {
            kline.signal = this.closeSellSignal;
          }
        } else {
          const currentPrice = kline.prices.close;
          const priceDiff = currentPrice - posOpenPrice;
          const priceDiffPercent = priceDiff / posOpenPrice;

          if (lastSignal === this.closeBuySignal) {
            const stopLossReached = priceDiffPercent < -stopLossPercent;

            if (stopLossReached) {
              kline.signal = this.closeSignal;
              positionOpen = false;
            }
          } else {
            const stopLossReached = priceDiffPercent > stopLossPercent;

            if (stopLossReached) {
              kline.signal = this.closeSignal;
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
  private tradeInterval(symbol: string, timeframe: string, quantityUSD: number, leverage: number) {
    this.binanceController.getKlines(symbol, timeframe).then(res => {
      const mappedKlines: Array<Kline> = this.binanceController.mapResult(res.data);
      const cryptoQuantity = Number((quantityUSD / mappedKlines[mappedKlines.length - 1].prices.close)/** .toFixed(2) for binance */);
      mappedKlines.splice(-1);  // remove running timeframe
      console.log(mappedKlines.slice(-3))
      const ema = this.indicatorsController.ema(mappedKlines, 80);
      console.log(ema.slice(-3))

      const move = ema[ema.length - 1].ema - ema[ema.length - 2].ema > 0 ? 'up' : 'down';
      const lastMove = ema[ema.length - 2].ema - ema[ema.length - 3].ema > 0 ? 'up' : 'down';
      console.log(lastMove);
      console.log(move);

      const momentumSwitch = move !== lastMove;

      if (!this.tradingPositionOpen.get(symbol)) {
        if (momentumSwitch) {
          if (move === 'up') {
            // open long
            this.btseController.long(symbol, cryptoQuantity, leverage).catch(err => this.handleError(err));
            this.tradingPositionOpen.set(symbol, true);
          } else {
            // open short
            this.btseController.short(symbol, cryptoQuantity, leverage).catch(err => this.handleError(err));
            this.tradingPositionOpen.set(symbol, true);
          }
        }
      } else {
        if (momentumSwitch) {
          if (move === 'up') {
            // close short open long
            this.btseController.closeOrder(symbol).then(() => {
              this.btseController.long(symbol, cryptoQuantity, leverage).catch(err => this.handleError(err));
            }).catch(err => this.handleError(err));
          } else {
            // close long open short
            this.btseController.closeOrder(symbol).then(() => {
              this.btseController.short(symbol, cryptoQuantity, leverage).catch(err => this.handleError(err));
            }).catch(err => this.handleError(err));
          }
        }
      }
    });
  }

}