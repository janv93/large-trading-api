import axios from 'axios';
import BaseController from './base-controller';
import { Tweet, TwitterUser, TwitterTimeline } from '../interfaces';

export default class TwitterController extends BaseController {
  private baseUrl = 'https://api.twitter.com';
  private headers = {
    'Authorization': `Bearer ${process.env.twitter_bearer_token}`,
  };

  public getUserTweets(user: string | number): Promise<Array<Tweet>> {
    const url = this.baseUrl + '/1.1/statuses/user_timeline.json';

    const query = {
      exclude_replies: true,
      include_rts: false,
      count: 200,
      tweet_mode: 'extended'
    };

    if (typeof user === 'string') {
      query['screen_name'] = user;
    } else {
      query['user_id'] = user;
    }

    const finalUrl = this.createUrl(url, query);

    return axios.get(finalUrl, { headers: this.headers })
      .then(res => res.data.map(tweet => this.deletePropertiesEqualToValue({
        timestamp: (new Date(tweet.created_at)).getTime(),
        id: tweet.id,
        text: tweet.full_text,
        hashtags: tweet.entities.hashtags.map(h => h.text),
        symbols: tweet.entities.symbols.map(s => s.text),
        urls: tweet.entities.urls.map(u => u.url),
        user: {
          name: tweet.user.screen_name,
          id: tweet.user.id,
          followers: tweet.user.followers_count,
          following: tweet.user.friends_count
        }
      }, [])));  // remove any empty array properties
  }

  public getUserFriends(user: string): Promise<Array<TwitterUser>> {
    const url = this.baseUrl + '/1.1/friends/list.json';

    const query = {
      screen_name: user,
      count: 200
    };

    const finalUrl = this.createUrl(url, query);

    return axios.get(finalUrl, { headers: this.headers })
      .then(res => res.data.users.map(user => ({
        name: user.screen_name,
        id: user.id,
        followers: user.followers_count,
        following: user.friends_count
      })));
  }

  public async getFriendsWithTheirTweets(user: string): Promise<Array<TwitterTimeline>> {
    const friends = await this.getUserFriends(user);

    const friendTweets = await Promise.all(friends.map(async user => {
      const tweets = await this.getUserTweets(user.name);
      return { name: user.name, tweets };
    }));

    return friendTweets;
  }

  public filterTweetsOnlySymbols(tweets: Array<Tweet>): Array<Tweet> {
    return tweets.filter(tweet => tweet.symbols && tweet.symbols.length > 0);
  }
}