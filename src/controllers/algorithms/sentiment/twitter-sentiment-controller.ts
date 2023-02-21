import { Kline, Tweet, TwitterTimeline } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../other-apis/twitter-controller';
import BinanceController from '../../exchanges/binance-controller';
import OpenAi from '../../other-apis/openai-controller';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();
  private binance = new BinanceController();
  private openai = new OpenAi();

  public async setSignals(klines: Kline[], user: string): Promise<Kline[]> {
    const timelines = await this.twitter.getFriendsWithTheirTweets(user);
    const tweets = await this.getTweetSentiments(timelines);

    return klines;
  }

  private async getTweetSentiments(timelines: TwitterTimeline[]): Promise<Tweet[]> {
    const binanceSymbols = await this.binance.getUsdtBusdPairs();
    const shortBinanceSymbols = this.binance.pairsToSymbols(binanceSymbols);

    timelines.forEach(ti => ti.tweets.forEach(tw => tw.symbols = tw.symbols.filter(s => shortBinanceSymbols.includes(s.symbol)))); // filter out symbols not on binance
    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.symbols.length)); // filter out empty symbols
    timelines = timelines.filter(ti => ti.tweets.length > 0);

    const earliestTime = Date.now() - this.timeframeToMilliseconds('1m') * 100 * 1000;
    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.time < earliestTime));  // filter out tweets too far in the past

    const tweets: Tweet[] = timelines.flatMap(ti => ti.tweets);
    const tweetsWithSentiments = await this.openai.getSentiments(tweets);

    return tweetsWithSentiments;
  }
}