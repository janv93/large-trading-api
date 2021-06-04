const axios = require('axios');


export default class BinanceController {
  public klines = [];

  public getKlines(symbol: string, endTime?: string): Promise<any> {
    const baseUrl = 'https://fapi.binance.com/fapi/v1/klines';

    const query = {
      limit: '1000',
      interval: '1m',
      symbol: symbol
    };

    if (endTime) {
      query['endTime'] = endTime;
    }

    const klineUrl = this.createUrl(baseUrl, query);

    console.log('GET ' + klineUrl);
    return axios.get(klineUrl);
  }

  public getKlinesMultiple(symbol, times): Promise<any> {
    return new Promise((resolve, reject) => {
      this.getKlinesRecursive(symbol, null, times, resolve, reject);
    });
  }

  public getKlinesRecursive(symbol, endTime, times, resolve, reject) {
    this.getKlines(symbol, endTime).then(res => {
      this.klines = res.data.concat(this.klines);
      const start = res.data[0][0];
      const end = start - 60000;
      times--;

      if (times > 0) {
        this.getKlinesRecursive(symbol, end, times, resolve, reject);
      } else {
        console.log('Received total of ' + this.klines.length + ' klines');
        const firstDate = new Date(this.klines[0][0]);
        console.log('First date: ' + firstDate);
        const lastDate = new Date(this.klines[this.klines.length - 1][0]);
        console.log('Last date: ' + lastDate);
        resolve(this.klines);
      }

    }).catch(err => {
      this.handleError(err);
      reject(err);
    });
  }


  private createUrl(baseUrl, queryObj): string {
    let url = baseUrl;  
    let firstParam = true;
  
    Object.keys(queryObj).forEach(param => {
      const query = param + '=' + queryObj[param];
      firstParam ? url += '?' : url += '&';
      url += query;
      firstParam = false;
    });

    return url;
  }

  private handleError(err) {
    if (err.response && err.response.data) {
      console.log(err.response.data);
    } else {
      console.log(err);
    }
  }
}