import axios from 'axios';
import crypto from 'crypto';
import btoa from 'btoa';
import BaseController from '../base-controller';
import Database from '../../data/db';

export default class BTSEController extends BaseController {

  constructor() {
    super();
  }

  public long(symbol, quantity, leverage) {
    return this.createOrder(symbol, 'buy', quantity, leverage).then((res) => {
      console.log(res.data);
      console.log('LONG position opened');
    }).catch(err => this.handleError(err));
  }

  public short(symbol, quantity, leverage) {
    return this.createOrder(symbol, 'sell', quantity, leverage).then((res) => {
      console.log(res.data);
      console.log('SHORT position opened');
    }).catch(err => this.handleError(err));
  }

  public createOrder(symbol: string, side: string, quantity: number, leverage: number) {
    const now = Date.now();

    const query = {
      symbol,
      side,
      leverage,
      type: 'market',
      size: quantity,
      clientOid: now
    };

    const kcApiPassphrase = btoa(this.createHmac(process.env.kucoin_api_passphrase));
    const kcApiSignContent = now + 'POST' + '/api/v1/orders' + this.createQuery(query) + JSON.stringify(query)
    const kcApiSign = btoa(this.createHmac(kcApiSignContent));

    const options = {
      headers: {
        'KC-API-KEY': process.env.kucoin_api_key,
        'KC-API-SECRET': process.env.kucoin_api_secret,
        'KC-API-SIGN': kcApiSign,
        'KC-API-TIMESTAMP': now,
        'KC-API-PASSPHRASE': kcApiPassphrase,
        'KC-API-KEY-VERSION': 2
      }
    };

    const url = this.createUrl('https://api-futures.kucoin.com/api/v1/orders', query);

    console.log('POST ' + url);
    return axios.post(url, query, options);
  }

  public closeOrder(symbol: string) {
    const now = Date.now();

    const query = {
      symbol,
      type: 'market',
      clientOid: now,
      closeOrder: true
    };

    const kcApiPassphrase = btoa(this.createHmac(process.env.kucoin_api_passphrase));
    const kcApiSignContent = now + 'POST' + '/api/v1/orders' + this.createQuery(query) + JSON.stringify(query)
    const kcApiSign = btoa(this.createHmac(kcApiSignContent));

    const options = {
      headers: {
        'KC-API-KEY': process.env.kucoin_api_key,
        'KC-API-SECRET': process.env.kucoin_api_secret,
        'KC-API-SIGN': kcApiSign,
        'KC-API-TIMESTAMP': now,
        'KC-API-PASSPHRASE': kcApiPassphrase,
        'KC-API-KEY-VERSION': 2
      }
    };

    const url = this.createUrl('https://api-futures.kucoin.com/api/v1/orders', query);

    console.log('POST ' + url);
    return axios.post(url, query, options);
  }

  private createHmac(query): Buffer {
    return crypto.createHmac('sha256', process.env.kucoin_api_secret as any).update(query).digest()
  }

}