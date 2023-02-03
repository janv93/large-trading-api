import { Kline, TwitterTimeline } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../twitter-controller';
import BinanceController from '../../exchanges/binance-controller';
import CoinmarketcapController from '../../twitter-controller copy';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();
  private binance = new BinanceController();
  private cmc = new CoinmarketcapController();

  constructor() {
    super();
  }

  public async setSignals(klines: Array<Kline>, user: string): Promise<Array<Kline>> {
    try {
      const timelines = await this.twitter.getFriendsWithTheirTweets(user);
      this.processResponse(timelines);
      return klines;
    } catch (err) {
      this.handleError(err);
      throw err;
    }
  }

  private async processResponse(timelines: Array<TwitterTimeline>) {
    const timelinesWithSymbols = timelines.map(t => ({
      name: t.name,
      tweets: this.twitter.filterTweetsOnlySymbols(t.tweets)
    })).filter(t => t.tweets.length);

    const tweetsWithSymbols = timelinesWithSymbols.map(t => t.tweets.map(tweet => ({
      text: tweet.text,
      symbols: tweet.symbols,
      timestamp: tweet.time
    })));

    console.log(tweetsWithSymbols);

    const mappedSymbols = this.cmc.getSymbol('Bitcoin');

    const symbols = await this.binance.getSymbols();
  }
}