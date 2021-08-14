import IndicatorsController from '../technical-analysis/indicators-controller';
import { BinanceKline } from '../../interfaces';
import BaseController from '../base-controller';

export default class EmaController extends BaseController {
  private indicatorsController: IndicatorsController;

  constructor() {
    super();
    this.indicatorsController = new IndicatorsController();
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

}