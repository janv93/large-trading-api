import axios from 'axios';
import crypto from 'crypto';
import btoa from 'btoa';
import BaseController from '../base-controller';

export default class BtseController extends BaseController {
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

  public long(symbol, quantity, leverage): Promise<any> {
    return this.createOrder(symbol, 'BUY', quantity, leverage).then((res) => {
      console.log(res.data);
      console.log('LONG position opened');
    }).catch(err => this.handleError(err));
  }

  public short(symbol, quantity, leverage): Promise<any> {
    return this.createOrder(symbol, 'SELL', quantity, leverage).then((res) => {
      console.log(res.data);
      console.log('SHORT position opened');
    }).catch(err => this.handleError(err));
  }

  public createOrder(symbol: string, side: string, quantity: number, leverage: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.setLeverage(symbol, leverage).then(res => {
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
    
        console.log('POST ' + url);
        console.log('Body: ' + JSON.stringify(body));

        axios.post(url, body, options).then(res => resolve(res)).catch(err => reject(err));
      }).catch(err => reject(err));
    });
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

    console.log('POST ' + url);
    console.log('Body: ' + JSON.stringify(body));

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