import Indicators from '../technical-analysis/indicators';
import { Kline } from '../../interfaces';
import Base from '../base';

export default class Bb extends Base {
  private indicators = new Indicators();;

  public setSignals(klines: Kline[], algorithm: string, period: number): Kline[] {
    const bb = this.indicators.bb(klines, period);
    const klinesWithBb = klines.slice(-bb.length);

    const threshold = 0.003; // percent that the price has fall below lower band / rise above upper band for position to open
    let positionOpen = false;
    let positionOpenType: string;
    const takeProfitFactor = threshold * 4;
    const stopLossFactor = threshold * 1;
    let takeProfitPrice: number;
    let stopLossPrice: number;

    klinesWithBb.forEach((kline: Kline, index: number) => {
      if (!positionOpen) {
        if (kline.prices.close < bb[index].bb.lower - bb[index].bb.lower * threshold) {
          kline.algorithms[algorithm].signal = this.closeBuySignal;
          positionOpen = true;
          takeProfitPrice = kline.prices.close + kline.prices.close * takeProfitFactor;
          stopLossPrice = kline.prices.close - kline.prices.close * stopLossFactor;
          positionOpenType = this.closeBuySignal;
        } else if (kline.prices.close > bb[index].bb.upper + bb[index].bb.upper * threshold) {
          kline.algorithms[algorithm].signal = this.closeSellSignal;
          positionOpen = true;
          takeProfitPrice = kline.prices.close - kline.prices.close * takeProfitFactor;
          stopLossPrice = kline.prices.close + kline.prices.close * stopLossFactor;
          positionOpenType = this.closeSellSignal;
        }
      } else {
        if (positionOpenType === this.closeBuySignal) {
          if (kline.prices.close > takeProfitPrice || kline.prices.close < stopLossPrice) {
            kline.algorithms[algorithm].signal = this.closeSignal;
            positionOpen = false;
          }
        } else if (positionOpenType === this.closeSellSignal) {
          if (kline.prices.close < takeProfitPrice || kline.prices.close > stopLossPrice) {
            kline.algorithms[algorithm].signal = this.closeSignal;
            positionOpen = false;
          }
        }
      }
    });

    return klines;
  }

}