import axios from 'axios';
import OAuth from 'oauth';
import { promisify } from 'util';
import BaseController from './base-controller';
import { Tweet, TwitterUser, TwitterTimeline } from '../interfaces';


export default class TwitterController extends BaseController {
  private baseUrl = 'https://api.twitter.com';
  private headers = {
    'Authorization': `Bearer ${process.env.twitter_bearer_token}`,
  };

  public async getUserTweets(user: string): Promise<Array<Tweet>> {
    const url = this.baseUrl + '/2/users/' + user + '/tweets';

    const query = {
      exclude: 'retweets,replies',
      max_results: 100,
      'tweet.fields': 'created_at',
    };

    const finalUrl = this.createUrl(url, query);
    const oauth = this.buildOAuth10A();

    return oauth(
      finalUrl,
      process.env.twitter_access_token,
      process.env.twitter_access_secret
    ).then(res => {
      const parsed = JSON.parse(res);

      if (!parsed.data) {
        return [];
      }

      return parsed.data.map(tweet => ({
        time: (new Date(tweet.created_at)).getTime(),
        id: tweet.id,
        text: tweet.text,
        symbols: this.getTweetSymbols(tweet.text),
      }))
    }).catch(err => this.handleError(err));
  }

  public getUserFriends(user: string): Promise<Array<TwitterUser>> {
    const url = this.baseUrl + '/1.1/friends/list.json';

    const query = {
      screen_name: user,
      count: 200
    };

    const finalUrl = this.createUrl(url, query);

    return axios.get(finalUrl, { headers: this.headers })
      .then(res => res.data.users.map(user => {
        return {
          name: user.screen_name,
          id: user.id_str,
          followers: user.followers_count,
          following: user.friends_count
        }
      })).catch(err => this.handleError(err));
  }

  public async getFriendsWithTheirTweets(user: string): Promise<Array<TwitterTimeline>> {
    const friends = await this.getUserFriends(user);

    const friendTweets = await Promise.all(friends.map(async user => {
      const tweets = await this.getUserTweets(user.id);
      return { name: user.name, tweets };
    }));

    return friendTweets;
  }

  public filterTweetsOnlySymbols(tweets: Array<Tweet>): Array<Tweet> {
    return tweets.filter(tweet => tweet.symbols && tweet.symbols.length);
  }

  private getTweetSymbols(text: string): Array<string> {
    const symbolPattern = /\$\w+/g;
    const symbols = text.match(symbolPattern);
    return symbols || [];
  }

  private buildOAuth10A(): Function {
    var oauth = new OAuth.OAuth(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      process.env.twitter_api_key,
      process.env.twitter_api_secret,
      '1.0A', null, 'HMAC-SHA1'
    )
    return promisify(oauth.get.bind(oauth))
  }
}