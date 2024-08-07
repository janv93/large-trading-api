import axios from 'axios';
import OAuth from 'oauth';
import { promisify } from 'util';
import Base from '../../base';
import binance from '../exchanges/binance';
import database from '../../data/database';
import Coinmarketcap from './coinmarketcap';
import { Tweet, TweetSymbol, TwitterUser, TwitterTimeline, Kline } from '../../interfaces';

export default class Twitter extends Base {
  private database = database;
  private cmc = new Coinmarketcap();
  private baseUrl = 'https://api.twitter.com';
  private callCounter = 0;

  private headers = {
    'Authorization': `Bearer ${process.env.twitter_bearer_token}`,
  };

  public async getUserTweets(userId: string, binanceSymbols: string[], startTime: number): Promise<Tweet[]> {
    if (this.callCounter > 2900) {
      console.log('Waiting 1 minute, call limit reached...');
      await new Promise(resolve => setTimeout(resolve, 60000));  // wait 1 minute after ~3000 call limit
      console.log('...Continue');
      this.callCounter = 0;
    }

    this.callCounter++;

    const url = this.baseUrl + '/2/users/' + userId + '/tweets';

    const query = {
      exclude: 'retweets,replies',
      max_results: 100,
      'tweet.fields': 'created_at',
      'user.fields': 'name',
      start_time: new Date(startTime).toISOString().slice(0, -5) + 'Z'
    };

    const finalUrl = this.createUrl(url, query);
    const oauth = this.buildOAuth2();
    const accessToken = await this.getOAuth2Token();

    try {
      const allTweets: Tweet[] = [];
      let nextToken: string | undefined = undefined;

      do {
        const tokenUrl = finalUrl + (nextToken ? `&pagination_token=${nextToken}` : '');
        const res = await oauth(tokenUrl, accessToken);
        const parsed = res.data || [];

        const mapped = parsed.map((tweet) => ({
          id: Number(tweet.id),
          time: new Date(tweet.created_at).getTime(),
          text: tweet.text,
          symbols: this.getTweetSymbols(tweet.text, binanceSymbols),
        }));

        const tweetsWithSymbols = mapped.filter((t) => t.symbols.length);
        allTweets.push(...tweetsWithSymbols);
        nextToken = res.meta?.next_token;
      } while (nextToken);

      const filteredTweets = allTweets.filter((t) => t.time >= startTime);
      filteredTweets.sort((a, b) => a.time - b.time);

      return filteredTweets;
    } catch (err) {
      console.log(finalUrl);
      this.handleError(err);
      return [];
    }
  }

  public async getAndSaveUserTweets(timeline: TwitterTimeline, binanceSymbols: string[], startTime: number): Promise<Tweet[]> {
    const latestTweet = timeline.tweets[timeline!.tweets.length - 1];
    const newTweets = await this.getUserTweets(timeline.id, binanceSymbols, latestTweet.time);
    const latestTweetIndex = newTweets.findIndex(tweet => tweet.id === latestTweet.id);
    const newTweetsFromIndex = latestTweetIndex > -1 ? newTweets.slice(latestTweetIndex + 1) : newTweets;
    const allTweets = [...timeline.tweets, ...newTweetsFromIndex];
    await this.database.updateTwitterUserTweets(timeline.id, allTweets);
    const tweetsFromStartTime = allTweets.filter(t => t.time >= startTime);
    return tweetsFromStartTime;
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

  public async getFriendsWithTheirTweets(userName: string, startTime: number): Promise<TwitterTimeline[]> {
    const binanceSymbols = await binance.getUsdtBusdPairs();
    const shortBinanceSymbols = binance.pairsToSymbols(binanceSymbols);
    const friends = await this.getFriends(userName);
    const latestUpdate = await this.database.getLatestTwitterChangeTime();
    const needsUpdate = latestUpdate != 0 ? (Date.now() - latestUpdate) / (1000 * 60) > 10 : true;  // latest change in database longer than 10 minutes in the past

    const timelines = await Promise.all(friends.map(async user => {
      const timeline = await this.database.getTwitterUserTimeline(user.id);

      if (timeline) { // user exists: update user
        const tweets = needsUpdate ? await this.getAndSaveUserTweets(timeline, shortBinanceSymbols, startTime) : timeline.tweets.filter(t => t.time >= startTime);
        return { id: user.id, tweets };
      } else {  // user not existing: create user
        const tweets = await this.getUserTweets(user.id, shortBinanceSymbols, startTime);
        await this.database.writeTwitterUserTimeline(user.id, tweets);
        return { id: user.id, tweets };
      }
    }));

    const timelinesWithTweets = timelines.filter(ti => ti.tweets.length);
    return timelinesWithTweets;
  }

  public addPriceToTweetSymbols(tweets: Tweet[], klines: Kline[]): Tweet[] {
    tweets.forEach(t => {
      const priceKline = klines.find((k, i) => {
        const nextKline = klines[i + 1];

        if (nextKline) {
          return k.times.open <= t.time && nextKline.times.open > t.time;
        }

        return false;
      });

      const klineSymbol = binance.pairToSymbol(klines[0].symbol);
      const symbol = t.symbols.find(s => s.symbol === klineSymbol);

      if (symbol && priceKline) {
        symbol.price = priceKline.prices.close;
      }
    });

    return tweets;
  }

  private getTweetSymbols(text: string, binanceSymbols: string[]): TweetSymbol[] {
    const allCryptos = this.cmc.getAllSymbols();
    const symbolPattern = /[$#]\w+/g; // preceeded by # or $
    const symbols = text.match(symbolPattern);

    if (symbols) {
      const mapped = symbols.map(s => {
        const formatted = s.slice(1).toLowerCase();
        const short = allCryptos[formatted] || formatted;
        return { symbol: short, originalSymbol: s };
      });

      const noDuplicates = mapped.filter((s, i) => i === mapped.findIndex(t => t.symbol === s.symbol));
      const specificLength = noDuplicates.filter(s => s.symbol.length >= 3 && s.symbol.length <= 5);
      const onlyBinanceSymbols = specificLength.filter(s => binanceSymbols.includes(s.symbol));
      return onlyBinanceSymbols;
    } else {
      return [];
    }
  }

  private buildOAuth10A(): Function {
    const oauth = new OAuth.OAuth(
      'https://api.twitter.com/oauth/request_token',
      'https://api.twitter.com/oauth/access_token',
      process.env.twitter_api_key,
      process.env.twitter_api_secret,
      '1.0A', null, 'HMAC-SHA1'
    );

    return promisify(oauth.get.bind(oauth))
  }

  private async getOAuth2Token(): Promise<string> {
    const response = await axios.post('https://api.twitter.com/oauth2/token', {},
      {
        auth: {
          username: process.env.twitter_api_key!,
          password: process.env.twitter_api_secret!,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        params: {
          grant_type: 'client_credentials',
        },
      }
    );
    return response.data.access_token;
  }

  private buildOAuth2(): Function {
    return async (url: string, accessToken: string) => {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.data;
    };
  }
}