import axios from 'axios';
import OAuth from 'oauth';
import { promisify } from 'util';
import BaseController from '../base-controller';
import database from '../../data/database';
import CoinmarketcapController from './coinmarketcap-controller';
import { Tweet, TweetSymbol, TwitterUser, TwitterTimeline } from '../../interfaces';

export default class TwitterController extends BaseController {
  private database = database;
  private cmc = new CoinmarketcapController();
  private baseUrl = 'https://api.twitter.com';
  private headers = {
    'Authorization': `Bearer ${process.env.twitter_bearer_token}`,
  };

  public async getUserTweets(userId: string): Promise<Tweet[]> {
    const url = this.baseUrl + '/2/users/' + userId + '/tweets';

    const query = {
      exclude: 'retweets,replies',
      max_results: 100,
      'tweet.fields': 'created_at',
      'user.fields': 'name',
    };

    const finalUrl = this.createUrl(url, query);
    const oauth = this.buildOAuth10A();

    try {
      const res = await oauth(
        finalUrl,
        process.env.twitter_access_token,
        process.env.twitter_access_secret
      );

      const parsed = JSON.parse(res).data || [];

      return parsed.map(tweet => {
        return {
          id: Number(tweet.id),
          time: (new Date(tweet.created_at)).getTime(),
          text: tweet.text,
          symbols: this.getTweetSymbols(tweet.text)
        }
      }).sort((a, b) => a.time - b.time);
    } catch (err) {
      console.log(finalUrl)
      this.handleError(err);
      return [];
    }
  }

  public async getAndSaveUserTweets(timeline: TwitterTimeline, needsUpdate: boolean): Promise<Tweet[]> {
    const latestTweet = timeline.tweets[timeline!.tweets.length - 1];

    if (needsUpdate) {
      const newTweets = await this.getUserTweets(timeline.id);
      const latestTweetIndex = newTweets.findIndex(tweet => tweet.id === latestTweet.id);
      const newTweetsFromIndex = latestTweetIndex > -1 ? newTweets.slice(latestTweetIndex + 1) : newTweets;
      const allTweets = [...timeline.tweets, ...newTweetsFromIndex];
      await this.database.updateTwitterUserTweets(timeline.id, allTweets);
      return allTweets;
    } else {
      return timeline.tweets;
    }
  }

  public async getFriends(user: string): Promise<TwitterUser[]> {
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

  public async getFriendsWithTheirTweets(userName: string): Promise<TwitterTimeline[]> {
    const friends = await this.getFriends(userName);
    const latestUpdate = await this.database.getLatestTwitterChangeTime();
    const needsUpdate = latestUpdate != 0 ? (Date.now() - latestUpdate) / (1000 * 60) > 10 : true;  // latest change in database longer than 10 minutes in the past

    const friendTweets = await Promise.all(friends.map(async user => {
      const timeline = await this.database.getTwitterUserTimeline(user.id);

      if (timeline) { // user exists: update user
        const tweets = await this.getAndSaveUserTweets(timeline, needsUpdate);
        return { id: user.id, tweets };
      } else {  // user not existing: create user
        const tweets = await this.getUserTweets(user.id);
        await this.database.writeTwitterUserTimeline(user.id, tweets);
        return { id: user.id, tweets };
      }
    }));

    const friendTweetsOnlySymbols = friendTweets.map(t => ({
      id: t.id,
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

    if (symbols) {
      const formattedSymbols = symbols.map(s => s.slice(1).toLowerCase());
      const noDuplicates = [...new Set(formattedSymbols)];
      const final = noDuplicates.map(s => ({ symbol: s }));
      return final;
    } else {
      return [];
    }
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