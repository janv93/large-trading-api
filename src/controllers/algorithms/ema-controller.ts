import IndicatorsController from '../technical-analysis/indicators-controller';
import { BinanceKucoinKline } from '../../interfaces';
import BaseController from '../base-controller';
import BinanceController from '../exchanges/binance-controller';
import KucoinController from '../exchanges/kucoin-controller';

export default class EmaController extends BaseController {
  private indicatorsController = new IndicatorsController();;
  private binanceController = new BinanceController();
  private kucoinController = new KucoinController();
  private tradingPositionOpen = new Map();

  constructor() {
    super();
  }

  public setSignals(klines: Array<BinanceKucoinKline>, period: number): Array<BinanceKucoinKline> {
    const ema = this.indicatorsController.ema(klines, period);
    const klinesWithEma = klines.slice(-ema.length);

    let lastMove: string;
    let positionOpen = false;
    let lastEma: number;
    let pivotEma: number;
    let threshold = 0.000;

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

      if (momentumSwitch) {
        pivotEma = lastEma;

        if (positionOpen) {
          const diffToPivot = e - pivotEma;
          const diffToPivotPercent = Math.abs(diffToPivot / pivotEma);

          if (move === 'up' && diffToPivotPercent > threshold) {
            kline.signal = this.buySignal;
          } else if (move === 'down' && diffToPivotPercent > threshold) {
            kline.signal = this.sellSignal;
          } else {
            kline.signal = this.closeSignal;
            positionOpen = false;
          }
        }
      }

      if (!positionOpen) {
        const diffToPivot = e - pivotEma;
        const diffToPivotPercent = Math.abs(diffToPivot / pivotEma);

        if (move === 'up' && diffToPivotPercent > threshold) {
          kline.signal = this.buySignal;
          positionOpen = true;
        } else if (move === 'down' && diffToPivotPercent > threshold) {
          kline.signal = this.sellSignal;
          positionOpen = true;
        }
      }

      lastMove = move;
      lastEma = e;
    });

    return klines;
  }

  public setSignalsSL(klines: Array<BinanceKucoinKline>, period: number): Array<BinanceKucoinKline> {
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
          kline.signal = this.buySignal;
          positionOpen = true;
        } else {
          kline.signal = this.sellSignal;
          positionOpen = true;
        }

        lastSignal = kline.signal;
      } else if (positionOpen) {
        if (momentumSwitch) {
          posOpenPrice = kline.prices.close;

          if (move === 'up') {
            kline.signal = this.buySignal;
          } else {
            kline.signal = this.sellSignal;
          }
        } else {
          const currentPrice = kline.prices.close;
          const priceDiff = currentPrice - posOpenPrice;
          const priceDiffPercent = priceDiff / posOpenPrice;

          if (lastSignal === this.buySignal) {
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

    const leverage = 20;
    const timeframe = '1h';
    const quantityUSD = 1300;
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
      const mappedKlines: Array<BinanceKucoinKline> = this.binanceController.mapResult(res.data);
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
            this.kucoinController.long(symbol, cryptoQuantity, leverage).catch(err => {
              this.handleError(err);
            });

            this.tradingPositionOpen.set(symbol, true);
          } else {
            // open short
            this.kucoinController.short(symbol, cryptoQuantity, leverage).catch(err => {
              this.handleError(err);
            });
            this.tradingPositionOpen.set(symbol, true);
          }
        }
      } else {
        if (momentumSwitch) {
          if (move === 'up') {
            // close short open long
            this.kucoinController.closeOrder(symbol).then(() => {
              this.binanceController.long(symbol, cryptoQuantity).catch(err => {
                this.handleError(err);
              });
            }).catch(err => {
              this.handleError(err);
            });
          } else {
            // close long open short
            this.kucoinController.closeOrder(symbol).then(() => {
              this.binanceController.short(symbol, cryptoQuantity).catch(err => {
                this.handleError(err);
              });
            }).catch(err => {
              this.handleError(err);
            });
          }
        }
      }
    });
  }

}