export default class BacktestController {
  constructor() {
  }

  public calcBacktestPerformance(klines, commission): Array<any> {
    const mappedKlines = this.mapKlines(klines);

    let percentProfit = 0.0;
    let lastKline: any;

    mappedKlines.forEach(kline => {
      if (kline.signal) {
        if (lastKline) {
          const diff = kline.close - lastKline.close;
          const percentage = diff / lastKline.close * 100;

          // if buy->sell, add percentage, and vice versa
          percentProfit += lastKline.signal === 'BUY' ? percentage : -percentage;
        }

        lastKline = kline;
      }

      kline['percentage'] = percentProfit;
    });

    return mappedKlines;
  }

  private mapKlines(klines: Array<any>): Array<any> {
    return klines.map(kline => {
      const mappedKline = {
        time: kline[0],
        close: Number(kline[4]),
      };

      if (kline[12]) {
        mappedKline['signal'] = kline[12]
      }

      return mappedKline;
    });
  }
}