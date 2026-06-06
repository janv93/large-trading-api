import { Algorithm, BacktestData, BacktestSignal, Kline, RsiDivergenceType, Signal } from '@shared';
import Base from '../../../../../base';
import Indicators from '../../../patterns/indicators';
import TrendLineController from '../../../patterns/trend-line';

export default class RsiDivergence extends Base {
  private indicators = new Indicators();
  private trendLineController = new TrendLineController();

  public setSignals(klines: Kline[], algorithm: Algorithm, params: any): void {
    const minLength: number = Number(params.minLength ?? 50);
    const maxLength: number = Number(params.maxLength ?? 200);
    const minStrength: number = Number(params.minStrength ?? 0.5);
    const stopLoss: number = Number(params.stopLoss ?? 0.02);

    this.trendLineController.addTrendLines(klines, minLength, maxLength, false, false);
    this.indicators.addRsiDivergence(klines, minStrength);

    const klinesWithDivergence = klines.filter(k => k.indicators?.rsiDivergence !== undefined);

    klinesWithDivergence.forEach((kline: Kline) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;
      const closePrice: number = kline.prices.close;
      const { regular, hidden } = kline.indicators!.rsiDivergence!;

      const regularType: RsiDivergenceType | undefined = regular?.type;
      const hiddenType: RsiDivergenceType | undefined = hidden?.type;
      const regularStrength: number = regular?.strength ?? 0;
      const hiddenStrength: number = hidden?.strength ?? 0;

      const regularBullish = regularType === RsiDivergenceType.Bullish;
      const regularBearish = regularType === RsiDivergenceType.Bearish;
      const hiddenBullish = hiddenType === RsiDivergenceType.HiddenBullish;
      const hiddenBearish = hiddenType === RsiDivergenceType.HiddenBearish;

      const isBullish = (regularBullish || hiddenBullish) && !regularBearish && !hiddenBearish;
      const isBearish = (regularBearish || hiddenBearish) && !regularBullish && !hiddenBullish;
      const strength: number = regularStrength + hiddenStrength;

      if (isBullish) {
        signals.push({
          signal: Signal.Buy,
          size: strength,
          price: closePrice,
          positionCloseTrigger: {
            tSl: { stopLoss },
          },
        });
      } else if (isBearish) {
        signals.push({
          signal: Signal.Sell,
          size: strength,
          price: closePrice,
          positionCloseTrigger: {
            tSl: { stopLoss },
          },
        });
      }
    });
  }
}

