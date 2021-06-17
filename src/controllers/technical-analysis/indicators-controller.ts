import * as TA from 'technicalindicators';
import * as TACopy from '../../utilities/technicalindicators-copy/index';

export default class IndicatorsController {
  constructor() {
  }

  /**
   * calculate rsi for each object in Array, starting at position length
   */
  public rsi(klines: Array<any>, length: number): Array<any> {
    const mappedKlines = this.mapKlines(klines);
    const values = mappedKlines.map(kline => kline.close);

    const inputRsi = {
      values: values,
      period: length
    };

    const rsiValues = TA.RSI.calculate(inputRsi);

    const valuesWithRsi = rsiValues.map((value: any, index: number) => {
      return {
        time: mappedKlines[index + 14].time,
        rsi: value
      }
    });

    return valuesWithRsi;
  }

  public macd(klines: Array<any>, fast, slow, signal): Array<any> {
    const mappedKlines = this.mapKlines(klines);
    const values = mappedKlines.map(kline => kline.close);
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
        time: mappedKlines[values.length - macdValuesWithHistogram.length + index].time,
        histogram: value.histogram
      }
    });

    return valuesWithMacd;
  }

  /**
   * map to more readable format: time, close
   */
   private mapKlines(klines: Array<any>): Array<any> {
    return klines.map(kline => {
      const mappedKline = {
        time: kline[0],
        close: Number(kline[4]),
      };

      return mappedKline;
    });
  }
}