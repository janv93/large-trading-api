import { Kline, Tweet } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../twitter-controller';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();

  constructor() {
    super();
  }

  public setSignals(klines: Array<Kline>, user: string): Promise<Array<Kline>> {
    return new Promise((resolve, reject) => {
      this.twitter.getUserTweets(user)
      .then((tweets: Array<Tweet>) => {
        this.processTweets(tweets);
        resolve(klines);
      })
      .catch(err => {
        this.handleError(err);
        reject(err);
      });
    });
  }

  private processTweets(tweets: Array<Tweet>) {
    
  }
}