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
    const promises = klines.map(kline => {
      const newKline = new this.Kline({
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
      });
  
      return newKline.save();
    });
  
    try {
      await Promise.all(promises);
      console.log('Klines saved');
    } catch (err) {
      console.error('Failed to save klines: ', err);
    }
  }

  public async getKlines(symbol: string, timeframe: string): Promise<Kline[]> {
    try {
      const klines = await this.Kline.find({ symbol, timeframe }).sort({ openTime: 1 });

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
