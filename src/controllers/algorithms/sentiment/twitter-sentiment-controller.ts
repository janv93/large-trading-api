import { Kline, Tweet, TwitterTimeline } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../other-apis/twitter-controller';
import OpenAi from '../../other-apis/openai-controller';
import BinanceController from '../../exchanges/binance-controller';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();
  private openai = new OpenAi();
  private binance = new BinanceController();

  public async setSignals(klines: Kline[], user: string): Promise<Kline[]> {
    const timelines = await this.twitter.getFriendsWithTheirTweets(user, klines[0].times.open);
    const tweets = await this.getTweetSentiments(timelines, klines);
    const entryPrices: number[] = [];

    klines.forEach((kline: Kline, i: number) => {
      let amount = 0;
      const currentPrice = kline.prices.close;

      for (let i = entryPrices.length - 1; i >= 0; i--) {
        const p = entryPrices[i];
        const priceDiffPercent = (currentPrice - p) / p;
        const tpSlReached = this.isTpSlReached(this.buySignal, priceDiffPercent, 0.002, 0.04);
      
        if (tpSlReached) {
          amount--;
          entryPrices.splice(i, 1);
        }
      }

      const nextKline = klines[i + 1];

      if (nextKline) {
        const tweetsWithSameTime = tweets.filter(t => t.time >= kline.times.open && t.time < nextKline.times.open);
        const bullishTweets = tweetsWithSameTime.filter(t => t.symbols.map(s => s.sentiment).includes('bull'));
        const amountBullishTweets = bullishTweets.length;

        if (amountBullishTweets) {
          amount += amountBullishTweets;
          entryPrices.push(kline.prices.close);
        }
      }

      if (amount > 0) {
        kline.amount = amount;
        kline.signal = this.buySignal;
      } else if (amount < 0) {
        kline.amount = -amount;
        kline.signal = this.sellSignal;
      }
    });

    return klines;
  }

  private async getTweetSentiments(timelines: TwitterTimeline[], klines: Kline[]): Promise<Tweet[]> {
    const earliestTime = klines[0].times.open;
    const symbol = this.binance.pairToSymbol(klines[0].symbol);

    const tweets: Tweet[] = timelines.flatMap(ti => ti.tweets);
    const tweetsInTimeRange = tweets.filter(t => t.time > earliestTime);
    const tweetsWithSymbol = tweetsInTimeRange.filter(t => t.symbols.map(s => s.symbol).includes(symbol))
    const tweetsWithSentiments = await this.openai.getSentiments(tweetsWithSymbol);

    return tweetsWithSentiments;
  }
}