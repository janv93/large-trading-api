import axios, { AxiosResponse } from 'axios';
import Base from '../../base';
import cryptos from './coinmarketcap-all-cryptos';
import database from '../../data/database';


// stablecoins and commodity-backed tokens to exclude from market cap rankings
const EXCLUDED_COINS = new Set(['USDT', 'USDC', 'DAI', 'USD1', 'USDe', 'PYUSD', 'USDG', 'RLUSD', 'USDD', 'U', 'TUSD', 'EURC', 'FDUSD', 'XAUt', 'PAXG']);

// fallback top coins when no API key is configured (stablecoins excluded)
const FALLBACK_COINS = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'TRX', 'DOGE', 'HYPE', 'LEO', 'BCH', 'ADA', 'XMR', 'LINK', 'ZEC', 'CC', 'XLM', 'M', 'LTC', 'AVAX', 'HBAR', 'SUI', 'SHIB', 'TON', 'CRO', 'TAO'];

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

  public async getCryptosByMarketCap(rank: number): Promise<string[]> {
    this.log(`Get cryptos by market cap`);

    if (!process.env.coinmarketcap_api_key) return FALLBACK_COINS;

    const dbTickers: string[] | null = await database.getCmcTickersIfUpToDate();
    if (dbTickers && dbTickers.length >= rank) return dbTickers;

    const url: string = this.baseUrl + '/cryptocurrency/listings/latest';
    const res: AxiosResponse = await axios.get(url, { headers: this.headers });

    const filtered: string[] = (res.data.data as { symbol: string }[])
      .map(c => c.symbol)
      .filter(coin => !EXCLUDED_COINS.has(coin));

    await database.updateCmcTickers(filtered);
    return filtered;
  }

  public getAllSymbols(): any {
    return cryptos;
  }
}