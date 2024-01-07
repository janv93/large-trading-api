import Base from './base';
import { Kline } from '../interfaces';
import alpaca from './exchanges/alpaca';
import Binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Momentum from './algorithms/backtests/simple-backtests/momentum';
import Backtest from './algorithms/backtests/backtest';
import Indicators from './technical-analysis/indicators';
import Macd from './algorithms/backtests/simple-backtests/macd';
import Rsi from './algorithms/backtests/simple-backtests/rsi';
import Ema from './algorithms/backtests/simple-backtests/ema';
import Bb from './algorithms/backtests/simple-backtests/bb';
// import Tensorflow from './algorithms/ai/tensorflow';
import FlashCrash from './algorithms/backtests/simple-backtests/flash-crash';
import Dca from './algorithms/backtests/investing/dca';
import MeanReversion from './algorithms/backtests/investing/mean-reversion';
import TwitterSentiment from './algorithms/backtests/sentiment/twitter-sentiment';
import MultiTicker from './algorithms/backtests/simple-backtests/multi-ticker';
import Trendline from './algorithms/backtests/simple-backtests/trendline';
import Nasdaq from './other-apis/nasdaq';
import Coinmarketcap from './other-apis/coinmarketcap';


export default class Routes extends Base {
  private binance = new Binance();
  private kucoin = new Kucoin();
  private indicators = new Indicators();
  private momentum = new Momentum();
  private backtest = new Backtest();
  private macd = new Macd();
  private rsi = new Rsi();
  private ema = new Ema();
  private bb = new Bb();
  // private tensorflow = new Tensorflow();
  private flashCrash = new FlashCrash();
  private dca = new Dca();
  private meanReversion = new MeanReversion();
  private twitterSentiment = new TwitterSentiment();
  private multiTicker = new MultiTicker();
  private trendline = new Trendline();
  private nasdaq = new Nasdaq();
  private cmc = new Coinmarketcap();

  /**
   * get list of klines / candlesticks and add buy and sell signals
   * 
   * algorithm is passed through body parameter 'algorithm'
   * depending on algorithm, additional query params may be necessary
   */
  public async getKlinesWithAlgorithm(req, res): Promise<void> {
    const body = req.body;
    const allKlines = await this.initKlines(body.exchange, body.symbol, body.timeframe);

    try {
      let klinesInRange = allKlines.slice(-1000 * Number(body.times));    // get last times * 1000 timeframes

      for (const algorithm of body.algorithms) {
        klinesInRange = await this.handleAlgo(klinesInRange, algorithm);
      }

      res.send(klinesInRange);
    } catch (err: any) {
      if (err === 'invalid') {
        res.send('Algorithm does not exist');
      } else {
        this.handleError(err);
        res.status(500).json({ error: err.message });
      }
    }
  }

  public async runMultiTicker(req, res): Promise<void> {
    const body = req.body;
    const { timeframe, rank, autoParams, algorithms } = body;

    // stocks
    const stocksSymbols = await this.getMultiStocks(Number(rank));
    const stocks = await this.initKlinesMulti('alpaca', stocksSymbols, timeframe);

    // indexes
    const indexSymbols = ['SPY', 'QQQ', 'IWM', 'DAX'];
    const indexes = await this.initKlinesMulti('alpaca', indexSymbols, timeframe);

    // commodities
    const commoditySymbols = ['GLD', 'UNG', 'USO', 'COPX']; // gold, gas, oil, copper
    const commodities = await this.initKlinesMulti('alpaca', commoditySymbols, timeframe);

    // crypto
    const cryptosSymbols = await this.getMultiCryptos(Number(rank));
    const cryptos = await this.initKlinesMulti('binance', cryptosSymbols, timeframe);

    const allTickers: Kline[][] = [...stocks, ...indexes, ...commodities, ...cryptos];
    this.reduceTickersToLimit(allTickers);
    let tickersWithSignals: Kline[][] = allTickers;

    for (let i = 0; i < algorithms.length; i++) {
      if (autoParams[i]) {
        tickersWithSignals = this.multiTicker.handleAlgo(allTickers, algorithms[i].algorithm);
      } else {
        tickersWithSignals = await Promise.all(tickersWithSignals.map(async (klines: Kline[]) => {
          const klinesWithSignals: Kline[] = await this.handleAlgo(klines, algorithms[i]);
          return this.backtest.calcBacktestPerformance(klinesWithSignals, algorithms[i].algorithm, 0, true);
        }));
      }
    }

    res.send(tickersWithSignals);
  }

  public postBacktestData(req, res): void {
    const query = req.query;
    let klines: Kline[] = req.body;

    for (let algorithm in (req.body as Kline[])[0].algorithms) {
      klines = this.backtest.calcBacktestPerformance(klines, algorithm, Number(query.commission), this.stringToBoolean(query.flowingProfit));
    }

    res.send(klines);
  }

  public tradeStrategy(req, res): void {
    switch (req.query.strategy) {
      case 'ema': this.ema.trade(req.query.symbol, req.query.open ? true : false);
    }

    res.send('Running');
  }

  public postTechnicalIndicator(req, res): void {
    const query = req.query;
    const { indicator, length, fast, slow, signal, period } = query;
    let indicatorChart: any[] = [];

    switch (indicator) {
      case 'rsi': indicatorChart = this.indicators.rsi(req.body, Number(length)); break;
      case 'macd': indicatorChart = this.indicators.macd(req.body, Number(fast), Number(slow), Number(signal)); break;
      case 'ema': indicatorChart = this.indicators.ema(req.body, Number(period)); break;
      case 'bb': indicatorChart = this.indicators.bb(req.body, Number(period)); break;
      default: res.send(`Indicator "${indicator}" does not exist`); return;
    }

    res.send(indicatorChart);
  }

  private async handleAlgo(klines: Kline[], params): Promise<Kline[]> {
    const { algorithm, fast, slow, signal, length, period, periodOpen, periodClose, threshold, profitBasedTrailingStopLoss, streak, user } = params;

    klines.forEach((kline: Kline) => {
      kline.algorithms[algorithm] = {};
    });

    switch (algorithm) {
      case 'momentum':
        return this.momentum.setSignals(klines, algorithm, streak);
      case 'macd':
        return this.macd.setSignals(klines, algorithm, fast, slow, signal);
      case 'rsi':
        return this.rsi.setSignals(klines, algorithm, Number(length));
      case 'ema':
        return this.ema.setSignals(klines, algorithm, Number(periodOpen), Number(periodClose));
      case 'emasl':
        return this.ema.setSignalsSL(klines, algorithm, Number(periodClose));
      case 'bb':
        return this.bb.setSignals(klines, algorithm, Number(period));
      // case 'deepTrend':
      //   return this.tensorflow.setSignals(klines, algorithm);
      case 'flashCrash':
        return this.flashCrash.setSignals(klines, algorithm);
      case 'dca':
        return this.dca.setSignals(klines, algorithm);
      case 'meanReversion':
        return this.meanReversion.setSignals(klines, algorithm, Number(threshold), Number(profitBasedTrailingStopLoss));
      case 'twitterSentiment':
        return await this.twitterSentiment.setSignals(klines, algorithm, user);
      case 'trendline':
        return await this.trendline.setSignals(klines, algorithm);
      default: throw 'invalid';
    }
  }

  private async initKlines(exchange: string, symbol: string, timeframe: string): Promise<Kline[]> {
    let exchangeObj;

    switch (exchange) {
      case 'binance': exchangeObj = this.binance; break;
      case 'kucoin': exchangeObj = this.kucoin; break;
      case 'alpaca': exchangeObj = alpaca; break;
    }

    return exchangeObj.initKlinesDatabase(symbol, timeframe);
  }

  private async initKlinesMulti(exchange: string, symbols: string[], timeframe: string): Promise<Kline[][]> {
    const klines: Kline[][] = await Promise.all(symbols.map(symbol => this.initKlines(exchange, symbol, timeframe)));
    return klines.filter(k => k.length);  // filter out not found symbols
  }

  private async getMultiStocks(rank: number): Promise<string[]> {
    const capStocks = this.nasdaq.getStocksByMarketCapRank(rank).map(s => s.symbol);
    const alpacaStocks = await alpaca.getAssets();
    const stocksFiltered = alpacaStocks.filter(s => capStocks.includes(s));
    return stocksFiltered;
  }

  private async getMultiCryptos(rank: number): Promise<string[]> {
    const capCryptos = await this.cmc.getCryptosByMarketCapRank(rank);
    const capCryptosFiltered = capCryptos.filter((c: string) => !['USDC', 'USDT'].includes(c));
    const binanceCryptos = await this.binance.getUsdtBusdPairs();

    const binanceEquivalents = capCryptosFiltered.map((c: string) => {
      const usdtSymbol = binanceCryptos.find(v => v === c + 'USDT');
      const busdSymbol = binanceCryptos.find(v => v === c + 'BUSD');
      return usdtSymbol || busdSymbol;
    });

    const cryptosFiltered = binanceEquivalents.filter((c: string) => c !== undefined);
    return cryptosFiltered;
  }

  /**
   * express has a limit for max response length
   */
  private reduceTickersToLimit(tickers: Kline[][]) {
    const klineLimit = 1.8 * 10 ** 6; // 1.8 million rough limit
    const totalKlinesLength = tickers.reduce((acc, curr) => acc + curr.length, 0);
    let diff = totalKlinesLength - klineLimit;
    if (diff <= 0) return;

    while (diff > 0) {
      const maxLength = Math.max(...tickers.map(t => t.length));
      const allEqualLength = tickers.every(t => t.length === maxLength);

      if (allEqualLength) {
        const subAmountPerTicker = diff / tickers.length;
        tickers.forEach((t, i) => tickers[i] = t.slice(subAmountPerTicker));
        break;  // done
      }

      const numTickersWithMaxLength = tickers.filter(t => t.length === maxLength).length;

      if (diff < numTickersWithMaxLength) break;  // done

      const unique = Array.from(new Set(tickers.map(t => t.length)));
      const sorted = unique.sort((a, b) => a - b);
      const secondLongest = sorted[sorted.length - 2];
      const subAmount = maxLength - secondLongest;
      const diffPerTickerWithMaxLength = diff / numTickersWithMaxLength;
      const finalSubAmount = Math.min(subAmount, diffPerTickerWithMaxLength);

      for (let i = 0; i < tickers.length; i++) {
        if (tickers[i].length === maxLength) {
          tickers[i] = tickers[i].slice(finalSubAmount);
          diff -= finalSubAmount;
        }
      }
    }
  }
}