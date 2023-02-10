import mongoose from 'mongoose';
import BaseController from '../controllers/base-controller';
import { Kline } from '../interfaces';
import { KlineSchema } from './schemas';

mongoose.set('strictQuery', true);

class Database extends BaseController {
  private Kline: mongoose.Model<any>;

  constructor() {
    super();
    this.init();
    this.Kline = mongoose.model('Kline', KlineSchema);
  }

  public async writeKlines(symbol: string, timeframe: string, klines: Kline[]) {
    console.log();
    console.log('Writing ' + klines.length + ' klines...');
    const start = Date.now();

    const bulkWriteOperations = klines.map(kline => ({
      insertOne: {
        document: {
          symbol,
          timeframe,
          openPrice: kline.prices.open,
          closePrice: kline.prices.close,
          highPrice: kline.prices.high,
          lowPrice: kline.prices.low,
          openTime: kline.times.open,
          closeTime: kline.times.close,
          volume: kline.volume,
          numberOfTrades: kline.numberOfTrades
        }
      }
    }));

    try {
      await this.Kline.bulkWrite(bulkWriteOperations, { ordered: false, writeConcern: { w: 0 } });
      const end = Date.now();
      const diff = ((end - start) % (1000 * 60)) / 1000; // in seconds
      const diffPer10k = diff / (klines.length / 10000);
      console.log('Done writing. Speed per 10k klines was ' + diffPer10k.toFixed(2) + 's.');
      console.log();
    } catch (err) {
      console.error('Failed to save klines: ', err);
      console.log();
    }
  }

  public async getKlines(symbol: string, timeframe: string): Promise<Kline[]> {
    console.log();
    console.log('Reading klines...');
    const start = Date.now();

    try {
      const klines = await this.Kline.find({ symbol, timeframe }).sort({ openTime: 1 });

      if (klines.length) {
        const end = Date.now();
        const diff = ((end - start) % (1000 * 60)) / 1000; // in seconds
        const diffPer10k = diff / (klines.length / 10000);
        console.log('Read ' + klines.length + '. Speed per 10k klines was ' + diffPer10k.toFixed(2) + 's.');
        console.log();
      }

      const mappedKlines: Kline[] = klines.map(kline => ({
        times: {
          open: kline.openTime,
          close: kline.closeTime
        },
        prices: {
          open: kline.openPrice,
          close: kline.closePrice,
          high: kline.highPrice,
          low: kline.lowPrice
        },
        volume: kline.volume,
        numberOfTrades: kline.numberOfTrades
      }));

      return mappedKlines;
    } catch (err) {
      console.error('Failed to retrieve klines:', err);
      console.log();
      throw new Error(`Failed to retrieve klines for symbol "${symbol}" and timeframe "${timeframe}"`);
    }
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
