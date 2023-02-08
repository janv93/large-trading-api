import { Kline, TwitterTimeline } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../other-apis/twitter-controller';
import BinanceController from '../../exchanges/binance-controller';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();
  private binance = new BinanceController();

  public async setSignals(klines: Kline[], user: string): Promise<Kline[]> {
    const timelines = await this.twitter.getFriendsWithTheirTweets(user);
    await this.processTimelines(timelines);
    return klines;
  }

  private async processTimelines(timelines: TwitterTimeline[]) {
    const symbols = await this.binance.getSymbols();

    timelines.forEach(ti => ti.tweets.forEach(tw => tw.symbols = tw.symbols.filter(s => symbols.includes(s)))); // filter out symbols not on binance
    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.symbols.length)); // filter out empty symbols
    // timelines.forEach(t => console.log(t.tweets));

    const maxTime = this.timeframeToMilliseconds('1m') * 100 * 1000;
    const earliestTime = Date.now() - maxTime;

    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.time < earliestTime));  // filter out tweets too far in the past

    const tweetedSymbols: string[] = [];

    timelines.forEach(ti => ti.tweets.forEach(tw => tweetedSymbols.push(...tw.symbols))); // push all symbols in an array

    const uniqueTweetedSymbols = [...new Set(tweetedSymbols)];

    const responses = await Promise.all(uniqueTweetedSymbols.map(s => this.binance.initKlinesDatabase(s, '1m')));

    console.log(responses);
  }
}