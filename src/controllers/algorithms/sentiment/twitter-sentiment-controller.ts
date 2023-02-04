import { Kline, TwitterTimeline } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../other-apis/twitter-controller';
import BinanceController from '../../exchanges/binance-controller';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();
  private binance = new BinanceController();

  public async setSignals(klines: Array<Kline>, user: string): Promise<Array<Kline>> {
    const timelines = await this.twitter.getFriendsWithTheirTweets(user);
    this.processTimelines(timelines);
    return klines;
  }

  private async processTimelines(timelines: Array<TwitterTimeline>) {
    const symbols = await this.binance.getSymbols();

    timelines.forEach(ti => ti.tweets.forEach(tw => tw.symbols = tw.symbols.filter(s => symbols.includes(s)))); // filter out symbols not on binance
    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.symbols.length)); // filter out empty symbols
    timelines.forEach(t => console.log(t.tweets))
  }
}