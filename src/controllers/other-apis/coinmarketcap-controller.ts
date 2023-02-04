import axios from 'axios';
import BaseController from '../base-controller';
import cryptos from './coinmarketcap-all-cryptos';


export default class CoinmarketcapController extends BaseController {
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

  public getAllSymbols(): any {
    return cryptos;
  }
}