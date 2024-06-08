import { Algorithm, BacktestData, BacktestSignal, Kline, Signal, Timeframe, Tweet, TwitterTimeline } from '../../../../interfaces';
import Base from '../../../base';
import Twitter from '../../../other-apis/twitter';
import OpenAi from '../../../other-apis/openai';
import binance from '../../../exchanges/binance';
import Backtester from '../backtester/backtester';


export default class TwitterSentiment extends Base {
  private twitter = new Twitter();
  private openai = new OpenAi();
  private backtester = new Backtester();

  public async setSignals(klines: Kline[], algorithm: Algorithm): Promise<Kline[]> {
    const user: string = process.env.twitter_user as string;
    const initTime = Date.now() - this.timeframeToMilliseconds(Timeframe._1Minute) * 100 * 1000;  // init with 100k minutes, so that there are no conflicts in future calls
    await this.twitter.getFriendsWithTheirTweets(user, initTime)
    const timelines = await this.twitter.getFriendsWithTheirTweets(user, klines[0].times.open);
    const tweets = await this.getTweetSentiments(timelines, klines);
    binance.addTweetsToKlines(klines, tweets);
    this.createBacktests(klines, algorithm);
    return klines;
  }

  private createBacktests(klines: Kline[], algorithm: Algorithm) {
    const [lowestSl, highestSl, lowestTp, highestTp] = [0.001, 0.06, 0.002, 0.12];
    let [currentSl, currentTp] = [lowestSl, lowestTp];
    const constellations: number[][] = [];

    do {  // create map of all constellations of sl and tp
      do {
        if (currentTp > currentSl) {
          constellations.push([currentSl, currentTp]);
        }

        currentTp += 0.001;
      } while (currentTp <= highestTp);

      currentTp = lowestTp;
      currentSl += 0.001;
    } while (currentSl <= highestSl);

    const profits: any[] = [];

    constellations.forEach((c) => {
      const profit = this.backtestTpSl(klines, algorithm, c[0], c[1], true);
      profits.push({ sl: c[0], tp: c[1], profit });
    });

    profits.sort((a, b) => a.profit - b.profit);
    console.log(profits.slice(-10));  // log best tp/sls
    this.backtestTpSl(klines, algorithm, profits[profits.length - 1][0], profits[profits.length - 1][1], false);
    return klines;
  }

  private backtestTpSl(klines: Kline[], algorithm: Algorithm, stopLoss: number, takeProfit: number, reset: boolean): number {

    klines.forEach((kline: Kline) => {
      const backtest: BacktestData = kline.algorithms[algorithm]!;
      const signals: BacktestSignal[] = backtest.signals;

      const bullishTweets = !kline.tweets ? [] : kline.tweets.filter(t => {
        const sentiment = t.symbols[0].sentiment;
        return sentiment && sentiment > 8;
      });

      signals.push({
        signal: Signal.Buy,
        size: bullishTweets.length,
        price: kline.prices.close
      });
    });

    const klinesWithProfit = this.backtester.calcBacktestPerformance(klines, algorithm, 0, false);
    const finalProfit = klinesWithProfit[klinesWithProfit.length - 1].algorithms[algorithm]!.percentProfit;

    if (reset) {
      klines.forEach(k => { // reset signals and profits after each run
        k.algorithms[algorithm]! = {
          signals: []
        };
      });
    }

    return finalProfit!;
  }

  private async getTweetSentiments(timelines: TwitterTimeline[], klines: Kline[]): Promise<Tweet[]> {
    const earliestTime = klines[0].times.open;
    const symbol = binance.pairToSymbol(klines[0].symbol);
    const tweets: Tweet[] = timelines.flatMap(ti => ti.tweets);
    const tweetsInTimeRange = tweets.filter(t => t.time > earliestTime);
    const tweetsWithSymbol = tweetsInTimeRange.filter(t => t.symbols.map(s => s.symbol).includes(symbol));
    tweetsWithSymbol.forEach(t => t.symbols = t.symbols.filter(s => s.symbol === symbol));
    const tweetsWithPrice = this.twitter.addPriceToTweetSymbols(tweetsWithSymbol, klines);
    const tweetsWithSentiments = await this.openai.getSentiments(tweetsWithPrice);
    return tweetsWithSentiments;
  }
}