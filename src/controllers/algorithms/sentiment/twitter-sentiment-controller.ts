import { Kline, Tweet, TwitterTimeline } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../twitter-controller';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();

  constructor() {
    super();
  }

  public setSignals(klines: Array<Kline>, user: string): Promise<Array<Kline>> {
    return new Promise((resolve, reject) => {
      this.twitter.getFriendsWithTheirTweets(user)
      .then((timelines: Array<TwitterTimeline>) => {
        this.processResponse(timelines);
        resolve(klines);
      })
      .catch(err => {
        this.handleError(err);
        reject(err);
      });
    });
  }

  private processResponse(timelines: Array<TwitterTimeline>) {
    const timelinesWithSymbols = timelines.map(t => ({
      name: t.name,
      tweets: this.twitter.filterTweetsOnlySymbols(t.tweets)
    })).filter(t => t.tweets.length);

    const tweetsWithSymbols = timelinesWithSymbols.map(t => t.tweets.map(tweet => ({
      text: tweet.text,
      symbols: tweet.symbols
    })));

    console.log(tweetsWithSymbols);
  }
}