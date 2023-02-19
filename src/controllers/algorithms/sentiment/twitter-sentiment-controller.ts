import { Kline, Tweet, TwitterTimeline } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../other-apis/twitter-controller';
import BinanceController from '../../exchanges/binance-controller';
import OpenAi from '../../other-apis/openai-controller';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();
  private binance = new BinanceController();
  private openai = new OpenAi();

  public async setSignals(klines: Kline[], user: string): Promise<Kline[]> {
    const timelines = await this.twitter.getFriendsWithTheirTweets(user);
    await this.processTimelines(timelines);
    return klines;
  }

  private async processTimelines(timelines: TwitterTimeline[]) {
    const binanceSymbols = await this.binance.getUsdtBusdSymbols();

    const shortBinanceSymbols = binanceSymbols  // reduce trading pairs to symbol only
      .map(s => s.replace(/USDT|BUSD/g, ''))
      .map(s => s.toLowerCase());

    timelines.forEach(ti => ti.tweets.forEach(tw => tw.symbols = tw.symbols.filter(s => shortBinanceSymbols.includes(s.symbol)))); // filter out symbols not on binance
    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.symbols.length)); // filter out empty symbols
    timelines = timelines.filter(ti => ti.tweets.length > 0);

    const earliestTime = Date.now() - this.timeframeToMilliseconds('1m') * 100 * 1000;

    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.time < earliestTime));  // filter out tweets too far in the past

    const tweets: Tweet[] = timelines.flatMap(ti => ti.tweets);

    const tweetsWithSentiments = await this.openai.getSentiments(tweets);
    
    tweetsWithSentiments.forEach(t => {
      console.log(t.text);
      console.log(t.symbols);
    });

    /* const tweetedSymbols = {};

    timelines.forEach(ti => ti.tweets.forEach(tw => tw.symbols.forEach(s => tweetedSymbols[s] ? tweetedSymbols[s]++ : tweetedSymbols[s] = 1))); // create unique list with amount of symbol mentions

    const sortedSymbols = Object.keys(tweetedSymbols).sort((a, b) => tweetedSymbols[b] - tweetedSymbols[a]);  // sort by amount of mentions
    const correspondingBinanceSymbols: string[] = [];

    sortedSymbols.forEach(s => { // create array with corresponding binance symbols
      const binanceSymbolUsdt = (s + 'usdt').toUpperCase();
      const binanceSymbolBusd = (s + 'busd').toUpperCase();
      const usdtSymbolExists = binanceSymbols.includes(binanceSymbolUsdt);
      const busdSymbolExists = binanceSymbols.includes(binanceSymbolBusd);

      if (usdtSymbolExists) {
        correspondingBinanceSymbols.push(binanceSymbolUsdt);
      } else if (busdSymbolExists) {
        correspondingBinanceSymbols.push(binanceSymbolBusd);
      }
    }); */
  }
}