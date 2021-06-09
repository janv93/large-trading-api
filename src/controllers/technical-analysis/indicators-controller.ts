import * as TA from 'technicalindicators';


export default class IndicatorsController {
  constructor() {
  }

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