import Base from './base';
import { Algorithm, Exchange, Kline, Timeframe } from '../interfaces';
import alpaca from './exchanges/alpaca';
import binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Momentum from './algorithms/backtests/simple-backtests/momentum';
import Backtester from './algorithms/backtests/backtester/backtester';
import Indicators from './technical-analysis/indicators';
import Macd from './algorithms/backtests/simple-backtests/macd';
import Rsi from './algorithms/backtests/simple-backtests/rsi';
import Ema from './algorithms/backtests/simple-backtests/ema';
import Bb from './algorithms/backtests/simple-backtests/bb';
// import Tensorflow from './algorithms/ai/tensorflow';
import Dca from './algorithms/backtests/investing/dca';
import MeanReversion from './algorithms/backtests/investing/mean-reversion';
import TwitterSentiment from './algorithms/backtests/sentiment/twitter-sentiment';
import MultiTicker from './algorithms/backtests/simple-backtests/multi-ticker';
import TrendLineBreakthrough from './algorithms/backtests/simple-backtests/trend-line';
import Coinmarketcap from './other-apis/coinmarketcap';
import { Request, Response } from 'express';
import QueryString from 'qs';


export default class Routes extends Base {
  private kucoin = new Kucoin();
  private indicators = new Indicators();
  private momentum = new Momentum();
  private backtest = new Backtester();
  private macd = new Macd();
  private rsi = new Rsi();
  private ema = new Ema();
  private bb = new Bb();
  // private tensorflow = new Tensorflow();
  private dca = new Dca();
  private meanReversion = new MeanReversion();
  private twitterSentiment = new TwitterSentiment();
  private multiTicker = new MultiTicker();
  private trendLineBreakthrough = new TrendLineBreakthrough();
  private cmc = new Coinmarketcap();

  /**
   * get list of klines / candlesticks and add buy and sell signals
   * 
   * algorithm is passed through body parameter 'algorithm'
   * depending on algorithm, additional query params may be necessary
   */
  public async getKlinesWithAlgorithm(req: Request, res: Response): Promise<void> {
    const body = req.body;
    const { timeframe, times, exchange, symbol, algorithms } = body;
    const allKlines = await this.initKlines(exchange, symbol, timeframe);

    try {
      let klinesInRange = allKlines.slice(-1000 * Number(times));    // get last times * 1000 timeframes

      for (const algorithm of algorithms) {
        klinesInRange = await this.handleAlgo(klinesInRange, algorithm);
      }

      res.send(klinesInRange);
    } catch (err: any) {
      if (err === 'invalid') {
        res.status(500).json({ error: 'Algorithm does not exist' });
      } else {
        this.handleError(err);
        res.status(500).json({ error: err.message });
      }
    }
  }

  public async runMultiTicker(req: Request, res: Response): Promise<void> {
    const body = req.body;
    const { timeframe, times, rank, autoParams, algorithms } = body;
    const indexSymbols = ['SPY', 'QQQ', 'IWM', 'DAX'].slice(0, rank);
    const commoditySymbols = ['GLD', 'UNG', 'USO', 'COPX'].slice(0, rank); // gold, gas, oil, copper

    const [stocks, indexes, commodities, cryptos] = await Promise.all([
      this.getMultiStocks(Number(rank)).then((stocksSymbols: string[]) =>
        this.initKlinesMulti(Exchange.Alpaca, stocksSymbols, timeframe, times)
      ),
      this.initKlinesMulti(Exchange.Alpaca, indexSymbols, timeframe, times),
      this.initKlinesMulti(Exchange.Alpaca, commoditySymbols, timeframe, times),
      this.getMultiCryptos(Number(rank)).then((cryptosSymbols: string[]) =>
        this.initKlinesMulti(Exchange.Binance, cryptosSymbols, timeframe, times)
      )
    ]);

    const allTickers: Kline[][] = [...stocks, ...indexes, ...commodities, ...cryptos];
    this.reduceTickersToLimit(allTickers);
    let tickersWithSignals: Kline[][] = allTickers;

    for (let i = 0; i < algorithms.length; i++) {
      if (autoParams[i]) {
        tickersWithSignals = this.multiTicker.handleAlgo(allTickers, algorithms[i].algorithm);
      } else {
        tickersWithSignals = await Promise.all(tickersWithSignals.map(async (klines: Kline[]) => {
          const klinesWithSignals: Kline[] = await this.handleAlgo(klines, algorithms[i]);
          return this.backtest.calcBacktestPerformance(klinesWithSignals, algorithms[i].algorithm, 0);
        }));
      }
    }

    this.log('Multi finished');
    res.send(tickersWithSignals);
  }

  public postBacktestData(req: Request, res: Response): void {
    const query: QueryString.ParsedQs = req.query;
    let klines: Kline[] = req.body;

    for (const algorithm in (req.body as Kline[])[0].algorithms) {
      klines = this.backtest.calcBacktestPerformance(klines, algorithm as Algorithm, Number(query.commission));
    }

    res.send(klines);
  }

  public tradeStrategy(req: Request, res: Response): void {
    switch (req.query.strategy) {
      case Algorithm.Ema: this.ema.trade(req.query.symbol as string, req.query.open ? true : false);
    }

    res.send('Running');
  }

  public postTechnicalIndicator(req: Request, res: Response): void {
    const query: QueryString.ParsedQs = req.query;
    const { indicator, length, fast, slow, signal, period } = query;
    let indicatorChart: any[] = [];

    switch (indicator) {
      case Algorithm.Rsi: indicatorChart = this.indicators.rsi(req.body, Number(length)); break;
      case Algorithm.Macd: indicatorChart = this.indicators.macd(req.body, Number(fast), Number(slow), Number(signal)); break;
      case Algorithm.Ema: indicatorChart = this.indicators.ema(req.body, Number(period)); break;
      case Algorithm.Bb: indicatorChart = this.indicators.bb(req.body, Number(period)); break;
      default: res.send(`Indicator "${indicator}" does not exist`); return;
    }

    res.send(indicatorChart);
  }

  private async handleAlgo(klines: Kline[], params): Promise<Kline[]> {
    const { algorithm, fast, slow, signal, length, period, periodOpen, periodClose, threshold, profitBasedTrailingStopLoss, streak } = params;

    klines.forEach((kline: Kline) => {
      kline.algorithms[algorithm] = {
        signals: []
      };
    });

    switch (algorithm) {
      case Algorithm.Momentum:
        return this.momentum.setSignals(klines, algorithm, streak);
      case Algorithm.Macd:
        return this.macd.setSignals(klines, algorithm, fast, slow, signal);
      case Algorithm.Rsi:
        return this.rsi.setSignals(klines, algorithm, Number(length));
      case Algorithm.Ema:
        return this.ema.setSignals(klines, algorithm, Number(periodOpen), Number(periodClose));
      case Algorithm.Bb:
        return this.bb.setSignals(klines, algorithm, Number(period));
      //   case Algorithm.DeepTrend:
      //   return this.tensorflow.setSignals(klines, algorithm);
      case Algorithm.Dca:
        return this.dca.setSignals(klines, algorithm);
      case Algorithm.MeanReversion:
        return this.meanReversion.setSignals(klines, algorithm, Number(threshold), Number(profitBasedTrailingStopLoss));
      case Algorithm.TwitterSentiment:
        return await this.twitterSentiment.setSignals(klines, algorithm);
      case Algorithm.TrendLine:
        return await this.trendLineBreakthrough.setSignals(klines, algorithm);
      default: throw 'invalid';
    }
  }

  private async initKlines(exchange: string, symbol: string, timeframe: Timeframe): Promise<Kline[]> {
    let exchangeObj;

    switch (exchange) {
      case Exchange.Binance: exchangeObj = binance; break;
      case Exchange.Kucoin: exchangeObj = this.kucoin; break;
      case Exchange.Alpaca: exchangeObj = alpaca; break;
    }

    return exchangeObj.initKlinesDatabase(symbol, timeframe);
  }

  private async initKlinesMulti(exchange: string, symbols: string[], timeframe: Timeframe, times: number): Promise<Kline[][]> {
    const klines: Kline[][] = await Promise.all(symbols.map(symbol => this.initKlines(exchange, symbol, timeframe)));

    const klinesInRange: Kline[][] = klines.map((klines: Kline[]) => {
      return klines.slice(-1000 * Number(times)); // get last times * 1000 timeframes
    });

    return klinesInRange.filter(k => k.length);  // filter out not found symbols
  }

  private async getMultiStocks(rank: number): Promise<string[]> {
    const mostActiveStocks: string[] = await alpaca.getMostActiveStocks(rank);
    const stocksFiltered = mostActiveStocks.filter(s => mostActiveStocks.includes(s));
    return stocksFiltered;
  }

  private async getMultiCryptos(rank: number): Promise<string[]> {
    const capCryptos: string[] = await this.cmc.getCryptosByMarketCapRank(rank);
    const capCryptosFiltered: string[] = capCryptos.filter((c: string) => !['USDC', 'USDT'].includes(c));
    const binanceCryptos: string[] = await binance.getUsdtBusdPairs();

    const binanceEquivalents: Array<string | undefined> = capCryptosFiltered.map((c: string) => {
      const usdtSymbol = binanceCryptos.find(v => v === c + 'USDT');
      const busdSymbol = binanceCryptos.find(v => v === c + 'BUSD');
      return usdtSymbol || busdSymbol;
    });

    const cryptosFiltered: string[] = binanceEquivalents.filter((c: string | undefined) => c) as string[];
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