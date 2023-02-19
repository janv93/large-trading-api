import mongoose from 'mongoose';
import BaseController from '../controllers/base-controller';
import { Kline, TweetSentiment } from '../interfaces';
import { KlineSchema, TweetSymbolSentimentSchema } from './schemas';

mongoose.set('strictQuery', true);

class Database extends BaseController {
  private Kline: mongoose.Model<any>;
  private TweetSymbolSentiment: mongoose.Model<any>;

  constructor() {
    super();
    this.init();
    this.Kline = mongoose.model('Kline', KlineSchema);
    this.TweetSymbolSentiment = mongoose.model('TweetSymbolSentiment', TweetSymbolSentimentSchema);
  }

  public async writeKlines(symbol: string, timeframe: string, klines: Kline[]): Promise<void> {
    if (klines.length === 0) {
      console.log();
      console.log('0 klines to write. Exiting...');
      console.log();
      return;
    } else {
      console.log();
      console.log(`Writing ${klines.length} klines...`);
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
        console.error('Failed to write klines: ', err);
        console.log();
      }
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
        console.log('Read ' + klines.length + 'klines. Speed per 10k klines was ' + diffPer10k.toFixed(2) + 's.');
        console.log();
      } else {
        console.log('No klines found.');
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
      console.error(`Failed to retrieve klines for symbol "${symbol}" and timeframe "${timeframe}"`);
      console.error(err);
      console.log();
      return [];
    }
  }

  public async writeTweetSymbolSentiments(sentiments: TweetSentiment[]): Promise<void> {
    if (sentiments.length === 0) {
      console.log();
      console.log('0 sentiments to write. Exiting...')
      console.log();
      return;
    } else {
      console.log();
      console.log(`Writing ${sentiments.length} sentiments...`);
      const start = Date.now();

      const bulkWriteOperations = sentiments.map(s => ({
        insertOne: {
          document: {
            id: s.id,
            symbol: s.symbol,
            model: s.model,
            sentiment: s.sentiment,
            text: s.text
          }
        }
      }));

      try {
        await this.TweetSymbolSentiment.bulkWrite(bulkWriteOperations, { ordered: false, writeConcern: { w: 0 } });
        const end = Date.now();
        const diff = ((end - start) % (1000 * 60)) / 1000; // in seconds
        const diffPer10k = diff / (sentiments.length / 10000);
        console.log('Done writing. Speed per 10k sentiments was ' + diffPer10k.toFixed(2) + 's.');
        console.log();
      } catch (err) {
        console.error('Failed to write sentiments: ', err);
        console.log();
      }
    }
  }

  // single sentiment
  public async getTweetSymbolSentiment(id: number, symbol: string, model: string): Promise<string[]> {
    try {
      return this.TweetSymbolSentiment.find({ id, symbol, model });
    } catch (err) {
      console.error(`Failed to retrieve sentiment for id "${id}", symbol "${symbol}" and model "${model}"`);
      console.error(err);
      console.log();
      return [];
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

export default new Database();  // singleton
