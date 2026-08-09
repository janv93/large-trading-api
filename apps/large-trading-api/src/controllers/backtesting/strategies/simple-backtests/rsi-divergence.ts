import { Strategy, BacktestData, BacktestSignal, Bar, RsiDivergenceType, Signal } from '@shared';
import Base from '../../../../base';
import { stepRsiDivergence } from '../../../patterns/indicators/rsi-divergence';
import TrendLineController from '../../../patterns/trend-line';

export default class RsiDivergence extends Base {
  private trendLineController = new TrendLineController();

  public stepSetSignals(bars: Bar[], state: any, strategy: Strategy, params: any): void {
    const minLength: number = Number(params.minLength ?? 50);
    const maxLength: number = Number(params.maxLength ?? 200);
    const minStrength: number = Number(params.minStrength ?? 0.5);
    const stopLoss: number = Number(params.stopLoss ?? 0.02);
    state.trendLines ??= {};

    this.trendLineController.stepTrendLines(bars, state.trendLines, minLength, maxLength, false, false);
    stepRsiDivergence(bars, state.trendLines, minStrength);

    const bar: Bar = bars[bars.length - 1];
    const rsiDiv = bar.indicators?.rsiDivergence;
    if (!rsiDiv) return;

    const backtest: BacktestData = bar.backtests[strategy]!;
    const signals: BacktestSignal[] = backtest.signals;
    const closePrice: number = bar.prices.close;
    const { regular, hidden } = rsiDiv;

    const regularType = regular?.type;
    const hiddenType = hidden?.type;
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
      signals.push({ signal: Signal.Buy, size: strength, price: closePrice, positionCloseTrigger: { tSl: { stopLoss } } });
    } else if (isBearish) {
      signals.push({ signal: Signal.Sell, size: strength, price: closePrice, positionCloseTrigger: { tSl: { stopLoss } } });
    }
  }
}
