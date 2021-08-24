import IndicatorsController from '../technical-analysis/indicators-controller';
import { BinanceKline } from '../../interfaces';
import BaseController from '../base-controller';
import BinanceController from '../binance-controller';

export default class EmaController extends BaseController {
  private indicatorsController: IndicatorsController;
  private binanceController: BinanceController;

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
    let threshold = 0.0001;

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

  public trade() {
    const now = new Date();
    const minutes = now.getMinutes();

    const symbol = 'BTC';
    const timeframe = '1h';
    const quantity = 0.03;
    let positionOpen = false;

    this.binanceController.setLeverage(symbol, 20).then(() => {
      setTimeout(() => {  // wait for full hour
        setInterval(() => { // run every hour
          this.binanceController.getKlines(symbol + 'USDT', timeframe).then(res => {
            const mappedKlines: Array<BinanceKline> = this.binanceController.mapResult(res.data);
            mappedKlines.splice(-1);  // remove running timeframe
            console.log(mappedKlines.slice(-3))
            const ema = this.indicatorsController.ema(mappedKlines, 10);
            console.log(ema.slice(-3))

            const move = ema[ema.length - 1].ema - ema[ema.length - 2].ema > 0 ? 'up' : 'down';
            const lastMove = ema[ema.length - 2].ema - ema[ema.length - 3].ema > 0 ? 'up' : 'down';
            console.log(lastMove);
            console.log(move);

            const momentumSwitch = move !== lastMove;

            if (!positionOpen) {
              if (momentumSwitch) {
                if (move === 'up') {
                  // open long
                  this.binanceController.long(symbol, quantity).catch(err => {
                    this.handleError(err);
                  });
                  positionOpen = true;
                } else {
                  // open short
                  this.binanceController.short(symbol, quantity).catch(err => {
                    this.handleError(err);
                  });
                  positionOpen = true;
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
        }, 60 * 60000);
      }, (60 * 60000 + 10000) - minutes * 60000);
    }).catch(err => {
      this.handleError(err);
    });
  }

}