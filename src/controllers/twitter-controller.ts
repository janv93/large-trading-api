import axios from 'axios';
import BaseController from './base-controller';
import { Tweet } from '../interfaces';

export default class TwitterController extends BaseController {
  private baseUrl = 'https://api.twitter.com';

  constructor() {
    super();
  }

  public getUserTweets(user: string): Promise<Array<Tweet>> {
    const url = this.baseUrl + '/1.1/statuses/user_timeline.json';
    const query = {
      screen_name: user,
      exclude_replies: true,
      include_rts: false,
      count: 200
    };

    const finalUrl = this.createUrl(url, query);

    return axios.get(finalUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.twitter_bearer_token}`,
      }
    }).then(res => res.data.map(tweet => this.deletePropertiesEqualToValue({
      timestamp: (new Date(tweet.created_at)).getTime(),
      id: tweet.id,
      text: tweet.text,
      hashtags: tweet.entities.hashtags.map(h => h.text),
      symbols: tweet.entities.symbols.map(s => s.text),
      urls: tweet.entities.urls.map(u => u.url),
      user: tweet.user.screen_name,
      userId: tweet.user.id,
      userFollowers: tweet.user.followers_count,
      userFollowing: tweet.user.friends_count
    }, [])));  // remove any empty array properties
  }

}