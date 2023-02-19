import axios from 'axios';
import OAuth from 'oauth';
import { promisify } from 'util';
import BaseController from '../base-controller';
import CoinmarketcapController from './coinmarketcap-controller';
import { Tweet, TweetSymbol, TwitterUser, TwitterTimeline } from '../../interfaces';


export default class TwitterController extends BaseController {
  private cmc = new CoinmarketcapController();
  private baseUrl = 'https://api.twitter.com';
  private headers = {
    'Authorization': `Bearer ${process.env.twitter_bearer_token}`,
  };

  public async getUserTweets(user: string): Promise<Tweet[]> {
    const url = this.baseUrl + '/2/users/' + user + '/tweets';

    const query = {
      exclude: 'retweets,replies',
      max_results: 100,
      'tweet.fields': 'created_at',
      'user.fields': 'name'
    };

    const finalUrl = this.createUrl(url, query);
    const oauth = this.buildOAuth10A();

    try {
      const res = await oauth(
        finalUrl,
        process.env.twitter_access_token,
        process.env.twitter_access_secret
      );

      const parsed = JSON.parse(res);

      if (!parsed.data) {
        return [];
      }

      return parsed.data.map(tweet => {
        return {
          time: (new Date(tweet.created_at)).getTime(),
          id: tweet.id,
          text: tweet.text,
          symbols: this.getTweetSymbols(tweet.text)
        }
      });
    } catch (err) {
      this.handleError(err);
      return [];
    }
  }


  public async getUserFriends(user: string): Promise<TwitterUser[]> {
    const url = this.baseUrl + '/1.1/friends/list.json';

    const query = {
      screen_name: user,
      count: 200
    };

    const finalUrl = this.createUrl(url, query);

    try {
      const res = await axios.get(finalUrl, { headers: this.headers });
      return res.data.users.map(user => {
        return {
          name: user.screen_name,
          id: user.id_str,
          followers: user.followers_count,
          following: user.friends_count
        }
      });
    } catch (err) {
      this.handleError(err);
      return [];
    }
  }


  public async getFriendsWithTheirTweets(user: string): Promise<TwitterTimeline[]> {
    const friends = await this.getUserFriends(user);

    const friendTweets = await Promise.all(friends.map(async user => {
      const tweets = await this.getUserTweets(user.id);
      return { name: user.name, tweets };
    }));

    const friendTweetsOnlySymbols = friendTweets.map(t => ({
      name: t.name,
      tweets: t.tweets.filter(tweet => tweet.symbols && tweet.symbols.length)
    })).filter(t => t.tweets.length);

    const allCryptos = this.cmc.getAllSymbols();

    friendTweetsOnlySymbols.forEach(ft => ft.tweets.forEach(tw => tw.symbols = tw.symbols
      .map(s => ({ symbol: allCryptos[s.symbol] || s.symbol, sentiment: undefined }))
      .filter(symbol => symbol.symbol.length >= 3 && symbol.symbol.length <= 5)
    ));

    return friendTweetsOnlySymbols;
  }

  private getTweetSymbols(text: string): TweetSymbol[] {
    const symbolPattern = /[$#]\w+/g; // preceeded by # or $
    const symbols = text.match(symbolPattern);
    return symbols ? symbols.map(s => ({ symbol: s.slice(1).toLowerCase() })) : []
  }

  private buildOAuth10A(): Function {
    var oauth = new OAuth.OAuth(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      process.env.twitter_api_key,
      process.env.twitter_api_secret,
      '1.0A', null, 'HMAC-SHA1'
    );

    return promisify(oauth.get.bind(oauth))
  }
}