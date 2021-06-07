export default class BacktestController {
  constructor() {
  }

  public calcBacktestPerformance(klines: Array<any>, commission: number, type: string): Array<any> {
    const mappedKlines = this.mapKlines(klines);

    switch (type) {
      case 'noClose': return this.calcPerformanceStrategyNoClose(mappedKlines, commission);
      case 'close': return this.calcPerformanceStrategyClose(mappedKlines, commission);
      default: return [];
    }
  }

  /**
   * calculate performance with no close strategy (strategy only containing buy and sell signals, revert strategy)
   */
  private calcPerformanceStrategyNoClose(klines: Array<any>, commission: number): Array<any> {
    let percentProfit = 0.0;
    let lastSignalKline: any;

    klines.forEach(kline => {
      if (kline.signal) {
        if (lastSignalKline) {
          const diff = kline.close - lastSignalKline.close;
          const percentage = diff / lastSignalKline.close * 100;

          // if buy->sell, add percentage, and vice versa
          percentProfit += lastSignalKline.signal === 'BUY' ? percentage : -percentage;
          percentProfit -= commission;
        }

        lastSignalKline = kline;
      }

      kline['percentage'] = percentProfit;
    });

    return klines;
  }

  /**
   * calculate performance with close strategy (strategy containing buy, sell and close signals)
   */
  private calcPerformanceStrategyClose(klines: Array<any>, commission: number): Array<any> {
    let percentProfit = 0.0;
    let lastSignalKline: any;

    klines.forEach(kline => {
      if (kline.signal) {
        if (lastSignalKline && lastSignalKline.signal !== 'CLOSE') {
          const diff = kline.close - lastSignalKline.close;
          const percentage = diff / lastSignalKline.close * 100;

          // if buy->sell, add percentage, and vice versa
          percentProfit += lastSignalKline.signal === 'BUY' ? percentage : -percentage;
          percentProfit -= commission;
        }

        lastSignalKline = kline;
      }

      kline['percentage'] = percentProfit;
    });

    return klines;
  }

  /**
   * map to more readable format: time, close, signal
   */
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