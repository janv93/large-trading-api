import axios from 'axios';
import Base from '../base';
import cryptos from './coinmarketcap-all-cryptos';


export default class Coinmarketcap extends Base {
  private baseUrl = 'https://pro-api.coinmarketcap.com/v1';

  private headers = {
    'X-CMC_Pro_API_Key': process.env.coinmarketcap_api_key
  };

  public async getSymbol(name: string) {
    const url = this.baseUrl + '/cryptocurrency/info';

    const query = {
      slug: name.toLowerCase()
    };

    const finalUrl = this.createUrl(url, query);

    const res = await axios.get(finalUrl, { headers: this.headers });
    return res.data.data['1'].symbol.toLowerCase();
  }

  public async getCryptosByMarketCapRank(rank: number): Promise<string[]> {
    this.log(`Get cryptos by market cap`);
    if (!process.env.coinmarketcap_api_key) return ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'USDC', 'XRP', 'DOGE', 'TON', 'ADA']; // API key should not be required to run /multi
    const url = this.baseUrl + '/cryptocurrency/listings/latest';
    const res = await axios.get(url, { headers: this.headers });
    const top = res.data.data.slice(0, rank);
    return top.map(c => c.symbol);
  }

  public getAllSymbols(): any {
    return cryptos;
  }
}