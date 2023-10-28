import Base from './base';
import { Kline } from '../interfaces';
import alpaca from './exchanges/alpaca';
import Binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Momentum from './algorithms/momentum';
import Backtest from './algorithms/backtest';
import Indicators from './technical-analysis/indicators';
import Macd from './algorithms/macd';
import Rsi from './algorithms/rsi';
import Ema from './algorithms/ema';
import Bb from './algorithms/bb';
// import Tensorflow from './algorithms/ai/tensorflow';
import FlashCrash from './algorithms/flash-crash';
import Dca from './algorithms/investing/dca';
import MeanReversion from './algorithms/investing/mean-reversion';
import TwitterSentiment from './algorithms/sentiment/twitter-sentiment';
import MultiTicker from './algorithms/multi-ticker';
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
  private nasdaq = new Nasdaq();
  private cmc = new Coinmarketcap();

  /**
   * get list of klines / candlesticks and add buy and sell signals
   * 
   * algorithm is passed through query parameter 'algorithm'
   * depending on algorithm, additional query params may be necessary
   */
  public async getKlinesWithAlgorithm(req, res): Promise<void> {
    const query = req.query;

    const allKlines = await this.initKlines(query.exchange, query.symbol, query.timeframe);

    try {
      const klinesInRange = allKlines.slice(-1000 * Number(query.times));    // get last times * 1000 timeframes
      let klinesWithSignals = await this.handleAlgo(klinesInRange, query);
      res.send(klinesWithSignals);
    } catch (err: any) {
      if (err === 'invalid') {
        res.send('Algorithm "' + query.algorithm + '" does not exist');
      } else {
        this.handleError(err);
        res.status(500).json({ error: err.message });
      }
    }
  }

  public async runMultiTicker(req, res): Promise<void> {
    const query = req.query;
    const { timeframe, algorithm, rank, autoParams } = query;

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
    let tickersWithSignals: Kline[][];

    if (this.stringToBoolean(autoParams)) {
      tickersWithSignals = this.multiTicker.setSignals(allTickers, algorithm);
    } else {
      tickersWithSignals = await Promise.all(allTickers.map(async (klines: Kline[]) => {
        const klinesWithSignals: Kline[] = await this.handleAlgo(klines, query);
        return this.backtest.calcBacktestPerformance(klinesWithSignals, 0, true);
      }));
    }

    res.send(tickersWithSignals);
  }

  public postBacktestData(req, res): void {
    const performance = this.backtest.calcBacktestPerformance(req.body, Number(req.query.commission), this.stringToBoolean(req.query.flowingProfit));
    res.send(performance);
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

  private async handleAlgo(responseInRange: Kline[], query): Promise<Kline[]> {
    const { algorithm, fast, slow, signal, length, periodOpen, periodClose, threshold, profitBasedTrailingStopLoss, streak, user } = query;

    switch (algorithm) {
      case 'momentum':
        return this.momentum.setSignals(responseInRange, streak);
      case 'macd':
        return this.macd.setSignals(responseInRange, fast, slow, signal);
      case 'rsi':
        return this.rsi.setSignals(responseInRange, Number(length));
      case 'ema':
        return this.ema.setSignals(responseInRange, Number(periodOpen), Number(periodClose));
      case 'emasl':
        return this.ema.setSignalsSL(responseInRange, Number(periodClose));
      case 'bb':
        return this.bb.setSignals(responseInRange, Number(length));
      // case 'deepTrend':
      //   return this.tensorflow.setSignals(responseInRange);
      case 'flashCrash':
        return this.flashCrash.setSignals(responseInRange);
      case 'dca':
        return this.dca.setSignals(responseInRange);
      case 'meanReversion':
        return this.meanReversion.setSignals(responseInRange, Number(threshold), Number(profitBasedTrailingStopLoss));
      case 'twitterSentiment':
        return await this.twitterSentiment.setSignals(responseInRange, user);
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
}