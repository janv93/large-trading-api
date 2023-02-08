import { Kline, TwitterTimeline } from '../../../interfaces';
import BaseController from '../../base-controller';
import TwitterController from '../../other-apis/twitter-controller';
import BinanceController from '../../exchanges/binance-controller';


export default class TwitterSentimentController extends BaseController {
  private twitter = new TwitterController();
  private binance = new BinanceController();

  public async setSignals(klines: Kline[], user: string): Promise<Kline[]> {
    const timelines = await this.twitter.getFriendsWithTheirTweets(user);
    await this.processTimelines(timelines);
    return klines;
  }

  private async processTimelines(timelines: TwitterTimeline[]) {
    const binanceSymbols = await this.binance.getUsdtBusdSymbols();

    const shortBinanceSymbols = binanceSymbols
      .map(s => s.replace(/USDT|BUSD/g, ''))
      .map(s => s.toLowerCase());

    timelines.forEach(ti => ti.tweets.forEach(tw => tw.symbols = tw.symbols.filter(s => shortBinanceSymbols.includes(s)))); // filter out symbols not on binance
    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.symbols.length)); // filter out empty symbols

    const earliestTime = Date.now() - this.timeframeToMilliseconds('1m') * 100 * 1000;

    timelines.forEach(ti => ti.tweets = ti.tweets.filter(tw => tw.time < earliestTime));  // filter out tweets too far in the past

    const tweetedSymbols = {};

    timelines.forEach(ti => ti.tweets.forEach(tw => tw.symbols.forEach(s => tweetedSymbols[s] ? tweetedSymbols[s]++ : tweetedSymbols[s] = 1))); // create unique list with amount of symbol mentions

    const sortedSymbols = Object.keys(tweetedSymbols).sort((a, b) => tweetedSymbols[b] - tweetedSymbols[a]);  // sort by amount of mentions
    const accordingBinanceSymbols: string[] = [];

    sortedSymbols.forEach(s => { // create array with according binance symbols
      const binanceSymbolUsdt = (s + 'usdt').toUpperCase();
      const binanceSymbolBusd = (s + 'busd').toUpperCase();
      const usdtSymbolExists = binanceSymbols.includes(binanceSymbolUsdt);
      const busdSymbolExists = binanceSymbols.includes(binanceSymbolBusd);

      if (usdtSymbolExists) {
        accordingBinanceSymbols.push(binanceSymbolUsdt);
      } else if (busdSymbolExists) {
        accordingBinanceSymbols.push(binanceSymbolBusd);
      }
    });

    const mostTweetedSymbols = accordingBinanceSymbols.slice(0, 10); // 10 most tweeted symbols

    await this.binance.initKlinesDatabase(mostTweetedSymbols[7], '1m');
    console.log('done');
    //const responses = await Promise.all(mostTweetedSymbols.map(s => this.binance.initKlinesDatabase(s, '1m')));

    //console.log(responses);
  }
}