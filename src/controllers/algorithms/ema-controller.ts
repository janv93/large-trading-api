import IndicatorsController from '../technical-analysis/indicators-controller';
import { BinanceKline } from '../../interfaces';
import BaseController from '../base-controller';
import BinanceController from '../binance-controller';

export default class EmaController extends BaseController {
  private indicatorsController: IndicatorsController;
  private binanceController: BinanceController;
  private tradingPositionOpen = false;

  constructor() {
    super();
    this.indicatorsController = new IndicatorsController();
    this.binanceController = new BinanceController();
  }

  public setSignals(klines: Array<BinanceKline>, period: number): Array<BinanceKline> {
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

  public setSignalsTPSL(klines: Array<BinanceKline>, period: number): Array<BinanceKline> {
    const ema = this.indicatorsController.ema(klines, period);
    const klinesWithEma = klines.slice(-ema.length);

    let lastMove: string;
    let positionOpen = false;
    let lastEma: number;
    let lastSignal: string;
    let posOpenPrice: number;
    const takeProfitPercent = 0.05;
    const stopLossPercent = 0.01;

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
        const currentPrice = kline.prices.close;
        const priceDiff = currentPrice - posOpenPrice;
        const priceDiffPercent = priceDiff / posOpenPrice;

        if (lastSignal === this.buySignal) {
          const takeProfitReached = priceDiffPercent > takeProfitPercent;
          const stopLossReached = priceDiffPercent < -stopLossPercent;

          if (takeProfitReached || stopLossReached) {
            kline.signal = this.closeSignal;
            positionOpen = false;
          }
        } else {
          const takeProfitReached = priceDiffPercent < -takeProfitPercent;
          const stopLossReached = priceDiffPercent > stopLossPercent;

          if (takeProfitReached || stopLossReached) {
            kline.signal = this.closeSignal;
            positionOpen = false;
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
  public trade() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const timeDiffToNextHour = 60 * 60000 - (minutes * 60000 + seconds * 1000);

    const leverage = 20;
    const symbol = 'ETH';
    const timeframe = '1h';
    const quantity = 0.5;

    this.binanceController.setLeverage(symbol, leverage).then(() => {
      console.log('Leverage set to ' + leverage);
      setTimeout(() => {  // wait for full hour
        this.tradeInterval(symbol, timeframe, quantity);
        setInterval(() => { // run every hour
          this.tradeInterval(symbol, timeframe, quantity);
        }, 60 * 60000);
      }, timeDiffToNextHour + 10000);
    }).catch(err => {
      this.handleError(err);
    });
  }

  /**
   * run trading algorithm in selected interval
   */
  private tradeInterval(symbol: string, timeframe: string, quantity: number) {
    this.binanceController.getKlines(symbol + 'USDT', timeframe).then(res => {
      const mappedKlines: Array<BinanceKline> = this.binanceController.mapResult(res.data);
      mappedKlines.splice(-1);  // remove running timeframe
      console.log(mappedKlines.slice(-3))
      const ema = this.indicatorsController.ema(mappedKlines, 80);
      console.log(ema.slice(-3))

      const move = ema[ema.length - 1].ema - ema[ema.length - 2].ema > 0 ? 'up' : 'down';
      const lastMove = ema[ema.length - 2].ema - ema[ema.length - 3].ema > 0 ? 'up' : 'down';
      console.log(lastMove);
      console.log(move);

      const momentumSwitch = move !== lastMove;

      if (!this.tradingPositionOpen) {
        if (momentumSwitch) {
          if (move === 'up') {
            // open long
            this.binanceController.long(symbol, quantity).catch(err => {
              this.handleError(err);
            });
            this.tradingPositionOpen = true;
          } else {
            // open short
            this.binanceController.short(symbol, quantity).catch(err => {
              this.handleError(err);
            });
            this.tradingPositionOpen = true;
          }
        }
      } else {
        if (momentumSwitch) {
          if (move === 'up') {
            // close short open long
            this.binanceController.long(symbol, quantity * 2).catch(err => {
              this.handleError(err);
            });
          } else {
            // close long open short
            this.binanceController.short(symbol, quantity * 2).catch(err => {
              this.handleError(err);
            });
          }
        }
      }
    });
  }

}