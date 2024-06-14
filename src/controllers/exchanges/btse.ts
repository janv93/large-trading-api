import axios from 'axios';
import crypto from 'crypto';
import Base from '../base';

export default class Btse extends Base {
  public setLeverage(symbol: string, leverage: number): Promise<any> {
    const now = Date.now();

    const body = {
      symbol: this.mapSymbol(symbol),
      leverage
    }

    const btseSignContent = '/api/v2.1/leverage' + now + JSON.stringify(body);
    const btseSign = this.createHmac(btseSignContent);

    const options = {
      headers: {
        'btse-api': process.env.btse_api_key,
        'btse-nonce': now,
        'btse-sign': btseSign
      }
    };

    const url = 'https://api.btse.com/futures/api/v2.1/leverage';

    return axios.post(url, body, options);
  }

  public async long(symbol, quantity, leverage): Promise<any> {
    const res = await this.createOrder(symbol, 'BUY', quantity, leverage);
    this.log(res.data);
    this.log('LONG position opened');
    return res;
  }

  public async short(symbol, quantity, leverage): Promise<any> {
    const res = await this.createOrder(symbol, 'SELL', quantity, leverage);
    this.log(res.data);
    this.log('SHORT position opened');
    return res;
  }

  public async createOrder(symbol: string, side: string, quantity: number, leverage: number): Promise<any> {
    try {
      await this.setLeverage(symbol, leverage);
      const mappedSymbol = this.mapSymbol(symbol);
      const now = Date.now();

      const body = {
        symbol: mappedSymbol,
        size: this.mapSize(mappedSymbol, quantity),
        side: side,
        type: 'MARKET'
      };

      const btseSignContent = '/api/v2.1/order' + now + JSON.stringify(body);
      const btseSign = this.createHmac(btseSignContent);

      const options = {
        headers: {
          'btse-api': process.env.btse_api_key,
          'btse-nonce': now,
          'btse-sign': btseSign
        }
      };

      const url = 'https://api.btse.com/futures/api/v2.1/order';

      this.log('POST ' + url);
      this.log('Body: ' + JSON.stringify(body));

      const res = await axios.post(url, body, options);
      return res;
    } catch (err) {
      this.handleError(err, symbol);
    }
  }

  public closeOrder(symbol: string): Promise<any> {
    const mappedSymbol = this.mapSymbol(symbol);
    const now = Date.now();

    const body = {
      symbol: mappedSymbol,
      type: 'MARKET'
    };

    const btseSignContent = '/api/v2.1/order/close_position' + now + JSON.stringify(body);
    const btseSign = this.createHmac(btseSignContent);

    const options = {
      headers: {
        'btse-api': process.env.btse_api_key,
        'btse-nonce': now,
        'btse-sign': btseSign
      }
    };

    const url = 'https://api.btse.com/futures/api/v2.1/order/close_position';

    this.log('POST ' + url);
    this.log('Body: ' + JSON.stringify(body));

    return axios.post(url, body, options);
  }

  private createHmac(query): string {
    return crypto.createHmac('sha384', process.env.btse_api_secret as any).update(query).digest('hex');
  }

  private mapSymbol(symbol: string): string {
    switch (symbol) {
      case 'BTCUSDT': return 'BTCPFC';
      case 'ETHUSDT': return 'ETHPFC';
      default: return '';
    }
  }

  /**
   * returns lot size for quantity
   */
  private mapSize(symbol: string, quantity: number): number {
    const contractSizes = {
      BTCPFC: 0.001,
      ETHPFC: 0.01,
    };

    return quantity / contractSizes[symbol];
  }

}