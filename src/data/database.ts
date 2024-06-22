import mongoose from 'mongoose';
import Base from '../base';
import { AppConfig, Kline, Timeframe, Tweet, TweetSentiment, TwitterTimeline } from '../interfaces';
import { KlineSchema, AlpacaSymbolsSchema, TwitterUserTimelineSchema, AppConfigSchema, CmcStocksSchema, BinanceSymbolsSchema } from './schemas';
import { DeleteResult } from 'mongodb';

mongoose.set('strictQuery', true);

class Database extends Base {
  private kline: mongoose.Model<any>;
  private twitterUserTimeline: mongoose.Model<any>;
  private alpacaSymbols: mongoose.Model<any>;
  private binanceSymbols: mongoose.Model<any>;
  private cmcStocks: mongoose.Model<any>;
  private appConfig: mongoose.Model<any>;

  constructor() {
    super();
    this.init();
    this.kline = mongoose.model('Kline', KlineSchema);
    this.twitterUserTimeline = mongoose.model('TwitterUserTimeline', TwitterUserTimelineSchema);
    this.alpacaSymbols = mongoose.model('AlpacaSymbols', AlpacaSymbolsSchema);
    this.binanceSymbols = mongoose.model('BinanceSymbols', BinanceSymbolsSchema);
    this.cmcStocks = mongoose.model('CmcStocks', CmcStocksSchema);
    this.appConfig = mongoose.model('AppConfig', AppConfigSchema);
  }

  public async writeKlines(klines: Kline[]): Promise<void> {
    if (klines.length === 0) {
      this.log('0 klines to write. Exiting...');
      return;
    } else {
      // check if doc with "filter" props exists. if not, adds doc with "filter" and "$setOnInsert" properties combined
      const bulkWriteOperations = klines.map(kline => ({
        updateOne: {
          filter: {
            symbol: kline.symbol,
            timeframe: kline.timeframe,
            openTime: kline.times.open,
            closeTime: kline.times.close
          },
          update: {
            $setOnInsert: {
              openPrice: kline.prices.open,
              closePrice: kline.prices.close,
              highPrice: kline.prices.high,
              lowPrice: kline.prices.low,
              volume: kline.volume,
              numberOfTrades: kline.numberOfTrades
            }
          },
          upsert: true
        }
      }));

      try {
        await this.kline.bulkWrite(bulkWriteOperations, { ordered: false, writeConcern: { w: 0 } });
        this.log(`Wrote <= ${klines.length} klines`);
      } catch (err) {
        this.logErr('Failed to write klines: ', err);
        throw err;
      }
    }
  }

  public async getKlines(symbol: string, timeframe: Timeframe): Promise<Kline[]> {
    try {
      const klines = await this.kline.find({ symbol, timeframe });

      if (klines.length) {
        this.log(`Read ${klines.length} klines for symbol ${symbol}`);
      } else {
        this.log('No klines found');
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
        numberOfTrades: kline.numberOfTrades,
        algorithms: {}
      }));

      mappedKlines.sort((a, b) => a.times.open - b.times.open);

      return mappedKlines;
    } catch (err) {
      this.logErr(`Failed to retrieve klines for symbol "${symbol}" and timeframe "${timeframe}"`, err);
      throw err;
    }
  }

  public async getAllUniqueSymbols(): Promise<string[]> {
    try {
      this.log(`Get all unique Symbols`);
      return await this.kline.distinct('symbol').exec();
    } catch (err) {
      this.logErr(`Failed to retrieve unique symbols`, err);
      throw err;
    }
  }

  public async deleteAllKlinesWithSymbol(symbol: string): Promise<void> {
    try {
      await this.kline.deleteMany({ symbol }).exec();
      this.log(`Delete all klines of symbol ${symbol}`);
    } catch (err) {
      this.logErr(`Failed deleting all klines of symbol ${symbol}`);
      throw err;
    }
  }

  // delete klines before a certain time too far in the past
  public async deleteOutdatedKlines(): Promise<number | null> {
    const appConfig: AppConfig | null = await this.getAppConfig();
    const oneDayAgo: Date = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (appConfig && appConfig.lastOutdatedKlineRemoval > oneDayAgo) {
      return null;
    }

    this.log('Deleting outdated klines');

    try {
      const deleteConditions = Object.values(Timeframe).map(timeframe => ({
        timeframe,
        openTime: { $lt: this.calcStartTime(timeframe) }
      }));

      const result: DeleteResult = await this.kline.deleteMany({
        $or: deleteConditions
      });

      const totalDeleted = result.deletedCount;
      this.log(`${totalDeleted} outdated klines deleted`);
      await this.updateLastOutdatedKlineRemoval();
      return totalDeleted;
    } catch (err) {
      this.logErr('Failed to delete klines: ', err);
      throw err;
    }
  }

  public async writeTweetSentiments(sentiments: TweetSentiment[]): Promise<void> {
    this.log(`Writing up to ${sentiments.length} sentiments...`);

    try {
      const timelines = await this.twitterUserTimeline.find();
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

      this.log(`Done writing ${newSentiments} sentiments`);
    } catch (err) {
      this.logErr(`Failed to write sentiments: `, err);
      throw err;
    }
  }

  // single sentiment
  public async getTweetSentiment(tweetId: number, symbol: string, model: string): Promise<number> {
    try {
      const timeline = await this.twitterUserTimeline.findOne({ 'tweets.id': tweetId });
      const tweet = timeline.tweets.find((t) => t.id === tweetId);
      const tweetSymbol = tweet.symbols.find((s) => s.symbol === symbol);
      const sentiment = tweetSymbol?.sentiments.find(s => s.model === model)?.sentiment || 0;
      return sentiment;
    } catch (err) {
      this.logErr(`Failed to retrieve sentiment for tweet "${tweetId}", symbol "${symbol}" and model "${model}"`, err);
      throw err;
    }
  }

  public async writeTwitterUserTimeline(userId: string, tweets: Tweet[]): Promise<void> {
    if (tweets.length === 0) {
      this.log('0 tweets to write. Exiting...');
      return;
    } else {
      this.log(`Writing ${tweets.length} tweets for user ${userId}...`);

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
        await this.twitterUserTimeline.create(userDocument);
        this.log(`Done writing tweets`);
      } catch (err) {
        this.logErr(`Failed to write tweets for user ${userId}: `, err);
        throw err;
      }
    }
  }

  public async getTwitterUserTimeline(userId: string): Promise<TwitterTimeline | null> {
    this.log(`Reading Twitter user ${userId}...`);

    try {
      const user = await this.twitterUserTimeline.findOne({ id: userId });

      if (user) {
        this.log(`Read Twitter user`);

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
        this.log(`Twitter user ${userId} not found`);
        return null;
      }
    } catch (err) {
      this.logErr(`Failed to retrieve Twitter user ${userId}: `, err);
      throw err;
    }
  }

  public async updateTwitterUserTweets(userId: string, newTweets: Tweet[]): Promise<void> {
    this.log(`Updating tweets for Twitter user ${userId}...`);

    try {
      const user = await this.twitterUserTimeline.findOne({ id: userId });

      if (user) {
        user.tweets = newTweets.map(tweet => ({
          id: tweet.id,
          time: tweet.time,
          text: tweet.text,
          symbols: tweet.symbols
        }));

        await user.save();

        this.log(`Updated tweets for Twitter user ${userId}`);
      } else {
        this.log(`Twitter user ${userId} not found`);
      }
    } catch (err) {
      this.logErr(`Failed to update tweets for Twitter user ${userId}: `, err);
      throw err;
    }
  }

  public async getLatestTwitterChangeTime(): Promise<number> {
    const latest = await this.twitterUserTimeline.findOne().sort({ updatedAt: -1 });

    if (latest) {
      const latestTimestamp = new Date(latest.updatedAt).getTime();
      return latestTimestamp;
    } else {
      return 0;
    }
  }

  public async getAlpacaSymbolsIfUpToDate(): Promise<string[] | null> {
    const oneDayAgo: Date = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const document = await this.alpacaSymbols.findOne({});

      if (document && document.updatedAt < oneDayAgo) {
        this.log(`Alpaca symbols outdated`);
        return null;
      }

      this.log(`Read alpaca symbols`);
      return document ? document.symbols : null;
    } catch (err) {
      this.logErr(`Failed to retrieve alpaca symbols`, err);
      throw err;
    }
  }

  public async updateAlpacaSymbols(symbols: string[]): Promise<void> {
    try {
      await this.alpacaSymbols.findOneAndUpdate({}, { symbols, updatedAt: new Date() }, { upsert: true });
      this.log(`Updated alpaca symbols`);
    } catch (err) {
      this.logErr('Failed to update alpaca symbols: ', err);
      throw err;
    }
  }

  public async getBinanceSymbolsIfUpToDate(): Promise<string[] | null> {
    const oneDayAgo: Date = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const document = await this.binanceSymbols.findOne({});

      if (document && document.updatedAt < oneDayAgo) {
        this.log(`Binance symbols outdated`);
        return null;
      }

      this.log(`Read binance symbols`);
      return document ? document.symbols : null;
    } catch (err) {
      this.logErr(`Failed to retrieve binance symbols`, err);
      throw err;
    }
  }

  public async updateBinanceSymbols(symbols: string[]): Promise<void> {
    try {
      await this.binanceSymbols.findOneAndUpdate({}, { symbols, updatedAt: new Date() }, { upsert: true });
      this.log(`Updated binance symbols`);
    } catch (err) {
      this.logErr('Failed to update binance symbols: ', err);
      throw err;
    }
  }

  public async getCmcStocksIfUpToDate(): Promise<string[] | null> {
    const oneDayAgo: Date = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const document = await this.cmcStocks.findOne({});

      if (document && document.updatedAt < oneDayAgo) {
        this.log(`CMC stocks outdated`);
        return null;
      }

      this.log(`Read CMC stocks`);
      return document ? document.stocks : null;
    } catch (err) {
      this.logErr(`Failed to retrieve CMC stocks`, err);
      throw err;
    }
  }

  public async updateCmcStocks(stocks: string[]): Promise<void> {
    try {
      await this.cmcStocks.findOneAndUpdate({}, { stocks, updatedAt: new Date() }, { upsert: true });
      this.log(`Updated CMC stocks`);
    } catch (err) {
      this.logErr('Failed to update CMC stocks: ', err);
      throw err;
    }
  }

  public async getHadStockSplitCleanup(): Promise<boolean> {
    const appConfig: AppConfig | null = await this.getAppConfig();
    return appConfig?.hadStockSplitCleanup ?? false;
  }

  public async setHadStockSplitCleanup(): Promise<void> {
    try {
      await this.appConfig.findOneAndUpdate({}, { hadStockSplitCleanup: true }, { upsert: true });
      this.log(`Set stock split cleanup flag`);
    } catch (err) {
      this.logErr(`Failed setting stock split cleanup flag`);
      throw err;
    }
  }

  private async updateLastOutdatedKlineRemoval(): Promise<void> {
    try {
      await this.appConfig.findOneAndUpdate({}, { lastOutdatedKlineRemoval: new Date() }, { upsert: true });
      this.log(`Updated last outdated kline removal date`);
    } catch (err) {
      this.logErr(`Failed updating last outdated kline removal date`);
      throw err;
    }
  }

  private async getAppConfig(): Promise<AppConfig | null> {
    try {
      const appConfig: AppConfig | null = await this.appConfig.findOne();
      this.log(`Read app config`);
      return appConfig;
    } catch (err) {
      this.logErr(`Failed to retrieve app config`, err);
      throw err;
    }
  }

  private async init() {
    try {
      await mongoose.connect(process.env.mongo_connection_string as string);
      this.log('Mongo connected');
    } catch (err) {
      this.logErr(err);
      throw err;
    }
  }
}

export default new Database();  // singleton
