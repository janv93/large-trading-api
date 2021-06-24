import Datastore from 'nedb';
import BaseController from '../controllers/base-controller';
import { BinanceKline } from '../interfaces';

export default class Database extends BaseController {
  private db = new Datastore({ filename: 'src/data/storage/candlesticks.db' });

  constructor() {
    super();
    this.db.loadDatabase();
  }

  public insert(value) {
    this.db.insert(value);
  }

  public findKlines(symbol: string, timeframe: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.find({ symbol, timeframe }, (err, docs) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs);
        }
      });
    });
  }

  public updateKlines(symbol: string, timeframe: string, klines: Array<BinanceKline>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.update({ symbol, timeframe }, { $set: { klines } }, (err, numReplaced) => {
        if (err) {
          reject(err);
        } else {
          resolve(numReplaced);
        }
      });
    })
  }

}
