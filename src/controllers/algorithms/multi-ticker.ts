import { Kline } from '../../interfaces';
import Base from '../base';
import Nasdaq from '../other-apis/nasdaq';
import Alpaca from '../exchanges/alpaca';

export default class MultiTicker extends Base {
  private nasdaq = new Nasdaq();
  private alpaca = new Alpaca();

  public async setSignals() {
    const capStocks = this.nasdaq.getStocksByMarketCap(3 * 10 ** 11).map(s => s.symbol);
    const alpacaStocks = await this.alpaca.getAssets();
    const stocksFiltered = alpacaStocks.filter(s => capStocks.includes(s));
    this.initStocks(stocksFiltered);
  }

  public async initStocks(stocks: string[]) {
    const tickers = await Promise.all(stocks.map(s => this.alpaca.initKlinesDatabase(s, '1w')));
    const symbols = tickers.map(t => {
      console.log(t[0])
      return t[0].symbol
    });
    console.log(stocks)
    console.log(symbols)
  }
}