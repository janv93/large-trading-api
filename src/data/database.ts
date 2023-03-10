import mongoose from 'mongoose';
import BaseController from '../controllers/base-controller';
import { Kline, Tweet, TweetSentiment, TwitterTimeline } from '../interfaces';
import { KlineSchema, TwitterUserTimelineSchema } from './schemas';

mongoose.set('strictQuery', true);

class Database extends BaseController {
  private Kline: mongoose.Model<any>;
  private TwitterUserTimeline: mongoose.Model<any>;

  constructor() {
    super();
    this.init();
    this.Kline = mongoose.model('Kline', KlineSchema);
    this.TwitterUserTimeline = mongoose.model('TwitterUserTimeline', TwitterUserTimelineSchema);
  }

  public async writeKlines(klines: Kline[]): Promise<void> {
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
            symbol: kline.symbol,
            timeframe: kline.timeframe,
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
        symbol: kline.symbol,
        timeframe: kline.timeframe,
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

  public async writeTweetSentiments(sentiments: TweetSentiment[]): Promise<void> {
    console.log(`Writing up to ${sentiments.length} sentiments...`)

    try {
      const timelines = await this.TwitterUserTimeline.find();
      let newSentiments = 0;

      await Promise.all(timelines.map(async (ti) => {
        sentiments.forEach((se) => {
          const tweet = ti.tweets.find((tw) => tw.id === se.id);

          if (tweet) {
            const symbol = tweet.symbols.find((sy) => sy.symbol === se.symbol);
            const sentimentAlreadyExists = symbol.sentiments.find(s => s.sentiment === se.sentiment && s.model === se.model);

            if (!sentimentAlreadyExists && se.sentiment) {
              symbol.sentiments.push({ sentiment: se.sentiment, model: se.model });
              newSentiments++;
            }
          }
        });

        await ti.save();
      }));

      console.log(`Done writing ${newSentiments} sentiments.`);
    } catch (err) {
      console.error(`Failed to write sentiments: `, err);
      console.log();
      return;
    }
  }

  // single sentiment
  public async getTweetSentiment(tweetId: number, symbol: string, model: string): Promise<number> {
    try {
      const timeline = await this.TwitterUserTimeline.findOne({ 'tweets.id': tweetId });
      const tweet = timeline.tweets.find((t) => t.id === tweetId);
      const tweetSymbol = tweet.symbols.find((s) => s.symbol === symbol);
      const sentiment = tweetSymbol?.sentiments.find(s => s.model === model)?.sentiment || 0;
      return sentiment;
    } catch (err) {
      console.error(`Failed to retrieve sentiment for tweet "${tweetId}", symbol "${symbol}" and model "${model}"`);
      console.error(err);
      console.log();
      return 0;
    }
  }

  public async writeTwitterUserTimeline(userId: string, tweets: Tweet[]): Promise<void> {
    if (tweets.length === 0) {
      console.log();
      console.log('0 tweets to write. Exiting...');
      console.log();
      return;
    } else {
      console.log();
      console.log(`Writing ${tweets.length} tweets for user ${userId}...`);

      const tweetDocuments = tweets.map(tweet => ({
        id: tweet.id,
        time: tweet.time,
        text: tweet.text,
        symbols: tweet.symbols.map(s => ({ symbol: s.symbol, originalSymbol: s.originalSymbol, sentiments: [] }))
      }));

      const userDocument = {
        id: userId,
        tweets: tweetDocuments
      };

      try {
        await this.TwitterUserTimeline.create(userDocument);
        console.log(`Done writing tweets.`);
        console.log();
      } catch (err) {
        console.error(`Failed to write tweets for user ${userId}: `, err);
        console.log();
      }
    }
  }

  public async getTwitterUserTimeline(userId: string): Promise<TwitterTimeline | null> {
    console.log();
    console.log(`Reading Twitter user ${userId}...`);

    try {
      const user = await this.TwitterUserTimeline.findOne({ id: userId });

      if (user) {
        console.log(`Read Twitter user.`);
        console.log();

        const mappedTweets = user.tweets
          .map(tweet => ({
            id: tweet.id,
            time: tweet.time,
            text: tweet.text,
            symbols: tweet.symbols
          }));

        mappedTweets.sort((a, b) => a.time - b.time);

        return {
          id: user.id,
          tweets: mappedTweets
        };
      } else {
        console.log(`Twitter user ${userId} not found.`);
        console.log();
        return null;
      }
    } catch (err) {
      console.error(`Failed to retrieve Twitter user ${userId}: `, err);
      console.log();
      return null;
    }
  }

  public async updateTwitterUserTweets(userId: string, newTweets: Tweet[]): Promise<void> {
    console.log();
    console.log(`Updating tweets for Twitter user ${userId}...`);

    try {
      const user = await this.TwitterUserTimeline.findOne({ id: userId });

      if (user) {
        user.tweets = newTweets.map(tweet => ({
          id: tweet.id,
          time: tweet.time,
          text: tweet.text,
          symbols: tweet.symbols
        }));

        await user.save();

        console.log(`Updated tweets for Twitter user ${userId}.`);
        console.log();
      } else {
        console.log(`Twitter user ${userId} not found.`);
        console.log();
      }
    } catch (err) {
      console.error(`Failed to update tweets for Twitter user ${userId}: `, err);
      console.log();
    }
  }

  public async getLatestTwitterChangeTime(): Promise<number> {
    const latest = await this.TwitterUserTimeline.findOne().sort({ updatedAt: -1 });

    if (latest) {
      const latestTimestamp = new Date(latest.updatedAt).getTime();
      return latestTimestamp;
    } else {
      return 0;
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
