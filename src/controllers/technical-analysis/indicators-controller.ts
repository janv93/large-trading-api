import * as TA from 'technicalindicators';
import * as TACopy from '../../utilities/technicalindicators-copy/index';
import { BinanceKline } from '../../interfaces';

export default class IndicatorsController {
  constructor() {
  }

  /**
   * calculate rsi for each object in Array, starting at position length
   */
  public rsi(klines: Array<BinanceKline>, length: number): Array<any> {
    const values = klines.map(kline => kline.prices.close);

    const inputRsi = {
      values: values,
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

  public macd(klines: Array<BinanceKline>, fast, slow, signal): Array<any> {
    const values = klines.map(kline => kline.prices.close);
    const smoothing = (Number(fast) + Number(slow)) / 2;

    const inputMacd = {
      values: values,
      fastPeriod: fast,
      slowPeriod: slow,
      signalPeriod: signal,
      smoothing: smoothing
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
}