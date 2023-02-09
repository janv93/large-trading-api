import mongoose from 'mongoose';
import BaseController from '../controllers/base-controller';
import { Kline, Snapshot } from '../interfaces';
import { SnapshotSchema } from './schemas';

mongoose.set('strictQuery', true);

class Database extends BaseController {
  private Snapshot: mongoose.Model<any>;

  constructor() {
    super();
    this.init();
    this.Snapshot = mongoose.model('Snapshot', SnapshotSchema);
  }

  public async writeSnapshot(value) {
    const specificKlines = new this.Snapshot(value);
    await specificKlines.save();
  }
  
  public async findSnapshot(symbol: string, timeframe: string): Promise<Snapshot> {
    const snapshot = await this.Snapshot.findOne({ symbol, timeframe });
    return snapshot;
  }
  
  public async updateSnapshot(symbol: string, timeframe: string, klines: Kline[]): Promise<any> {
    const result = await this.Snapshot.updateOne({ symbol, timeframe }, { $set: { klines } });
    return result.modifiedCount;
  }

  private async init() {
    try {
      await mongoose.connect(process.env.mongo_connection_string as string);
      console.log('Mongo connected');
    } catch (err) {
      console.error(err);
    }
  }
}

export default new Database();
