export default class BacktestController {
  constructor() {
  }

  public calcBacktestPerformance(klines, commission): Array<any> {
    const mappedKlines = this.mapKlines(klines);

    let percentProfit = 0.0;
    let lastPrice = mappedKlines[0].close;
    let lastSignal: string;
    const firstPrice = lastPrice;

    mappedKlines.forEach(kline => {
      if (kline.signal) {
        const diff = kline.close - lastPrice;
        const percentage = diff / firstPrice * 100;

        if (lastSignal) {
          // if buy->sell, add percentage, and vice versa
          percentProfit += lastSignal === 'BUY' ? percentage : -percentage;
          lastPrice = kline.close;
        }

        lastSignal = kline.signal;
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