import Datastore from 'nedb';
import BaseController from '../controllers/base-controller';
import { Kline } from '../interfaces';

export default class Database extends BaseController {
  private db: Datastore;

  constructor() {
    super();
    this.init();
  }

  public insert(value) {
    this.db.insert(value);
  }

  public findKlines(symbol: string, timeframe: string): Promise<any> {
    this.init();

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

  public updateKlines(symbol: string, timeframe: string, klines: Array<Kline>): Promise<any> {
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

  private init(): void {
    this.db = new Datastore({ filename: 'src/data/storage/candlesticks.db' });
    this.db.loadDatabase();
  }
}
