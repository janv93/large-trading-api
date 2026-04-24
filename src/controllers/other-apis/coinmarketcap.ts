import axios, { AxiosResponse } from 'axios';
import Base from '../../base';
import cryptos from './coinmarketcap-all-cryptos';
import database from '../../data/database';


export default class Coinmarketcap extends Base {
  private baseUrl = 'https://pro-api.coinmarketcap.com/v1';

  private headers = {
    'X-CMC_Pro_API_Key': process.env.coinmarketcap_api_key
  };

  public async getSymbol(name: string) {
    const url: string = this.baseUrl + '/cryptocurrency/info';

    const query = {
      slug: name.toLowerCase()
    };

    const finalUrl: string = this.createUrl(url, query);

    const res: AxiosResponse = await axios.get(finalUrl, { headers: this.headers });
    return res.data.data['1'].symbol.toLowerCase();
  }

  public async getCryptosByMarketCapRank(rank: number): Promise<string[]> {
    this.log(`Get top ${rank} cryptos by market cap`);
    if (!process.env.coinmarketcap_api_key) return ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'USDC', 'XRP', 'DOGE', 'TON', 'ADA'].slice(0, rank); // API key should not be required to run /multi
    const dbTickers: string[] | null = await database.getCmcTickersIfUpToDate();
    if (dbTickers && dbTickers.length >= rank) return dbTickers.slice(0, rank);
    const url: string = this.baseUrl + '/cryptocurrency/listings/latest';
    const res: AxiosResponse = await axios.get(url, { headers: this.headers });
    const top: string[] = res.data.data.map(c => c.symbol).filter(coin => !['USDT', 'USDC', 'DAI', 'USD1', 'USDe', 'PYUSD', 'USDG', 'RLUSD', 'USDD', 'U', 'TUSD', 'EURC', 'FDUSD', 'XAUt', 'PAXG'].includes(coin)).slice(0, rank);  // remove stable and gold coins
    await database.updateCmcTickers(top);
    return top;
  }

  public getAllSymbols(): any {
    return cryptos;
  }
}