import * as TA from 'technicalindicators';
import * as TACopy from '../../utilities/technicalindicators-copy/index';
import { Kline } from '../../interfaces';

export default class Indicators {
  constructor() {
  }

  /**
   * calculate rsi for each object in Array, starting at position length
   */
  public rsi(klines: Kline[], length: number): any[] {
    const values = klines.map(kline => kline.prices.close);

    const inputRsi = {
      values,
      period: length
    };

    const rsiValues = TA.RSI.calculate(inputRsi);

    const valuesWithRsi = rsiValues.map((value: any, index: number) => {
      return {
        time: klines[index + length].times.open,
        rsi: value
      }
    });

    return valuesWithRsi;
  }

  public macd(klines: Kline[], fast: number, slow: number, signal: number): any[] {
    const values = klines.map(kline => kline.prices.close);
    const smoothing = (fast + slow) / 2;

    const inputMacd = {
      values,
      fastPeriod: String(fast),
      slowPeriod: String(slow),
      signalPeriod: String(signal),
      smoothing
    };

    const macdValues = TACopy.MACD.calculate(inputMacd);
    const macdValuesWithHistogram = macdValues.filter(val => val.histogram !== undefined);

    const valuesWithMacd = macdValuesWithHistogram.map((value: any, index: number) => {
      return {
        time: klines[values.length - macdValuesWithHistogram.length + index].times.open,
        histogram: value.histogram
      }
    });

    return valuesWithMacd;
  }

  public ema(klines: Kline[], period: number) {
    const values = klines.map(kline => kline.prices.close);

    const inputEma = {
      period,
      values,
      smoothing: 2
    };

    const emaValues = TACopy.EMA.calculate(inputEma);

    const valuesWithEma = emaValues.map((value: any, index: number) => {
      return {
        time: klines[index + period - 1].times.open,
        ema: value
      }
    });

    return valuesWithEma;
  }

  public bb(klines: Kline[], period: number) {
    const values = klines.map(kline => kline.prices.close);

    const inputBb = {
      period,
      values,
      stdDev: 2
    };

    const bbValues = TA.BollingerBands.calculate(inputBb);

    const valuesWithBb = bbValues.map((value: any, index: number) => {
      return {
        time: klines[index + period - 1].times.open,
        bb: value
      };
    });

    return valuesWithBb;
  }
}