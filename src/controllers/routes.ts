import database from '../data/database';
import Base from './base';
import { Kline } from '../interfaces';
import Alpaca from './exchanges/alpaca';
import Binance from './exchanges/binance';
import Kucoin from './exchanges/kucoin';
import Momentum from './algorithms/momentum';
import Backtest from './algorithms/backtest';
import Indicators from './technical-analysis/indicators';
import Macd from './algorithms/macd';
import Rsi from './algorithms/rsi';
import Ema from './algorithms/ema';
import Bb from './algorithms/bb';
import Tensorflow from './algorithms/ai/tensorflow';
import FlashCrash from './algorithms/flash-crash';
import Dca from './algorithms/investing/dca';
import Martingale from './algorithms/investing/martingale';
import TwitterSentiment from './algorithms/sentiment/twitter-sentiment';
import MultiTicker from './algorithms/multi-ticker';


export default class Routes extends Base {
  private database = database;
  private alpaca = new Alpaca();
  private binance = new Binance();
  private kucoin = new Kucoin();
  private indicators = new Indicators();
  private momentum = new Momentum();
  private backtest = new Backtest();
  private macd = new Macd();
  private rsi = new Rsi();
  private ema = new Ema();
  private bb = new Bb();
  private tensorflow = new Tensorflow();
  private flashCrash = new FlashCrash();
  private dca = new Dca();
  private martingale = new Martingale();
  private twitterSentiment = new TwitterSentiment();
  private multiTicker = new MultiTicker();

  /**
   * get list of klines / candlesticks from binance
   */
  public async getKlines(req, res): Promise<void> {
    let exchange;

    switch (req.query.exchange) {
      case 'binance': exchange = this.binance; break;
      case 'kucoin': exchange = this.kucoin; break;
      case 'alpaca': exchange = this.alpaca; break;
    }

    const response = await exchange.getKlinesMultiple(req.query.symbol, req.query.times, req.query.timeframe);
    res.send(response);
  }

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
    const ret = await this.multiTicker.setSignals();
    res.send(ret);
  }

  public postBacktestData(req, res): void {
    const performance = this.backtest.calcBacktestPerformance(req.body, req.query.commission, this.stringToBoolean(req.query.flowingProfit));
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

  private async initKlines(exchange: string, symbol: string, timeframe: string): Promise<Kline[]> {
    let exchangeObj;

    switch (exchange) {
      case 'binance': exchangeObj = this.binance; break;
      case 'kucoin': exchangeObj = this.kucoin; break;
      case 'alpaca': exchangeObj = this.alpaca; break;
    }

    return exchangeObj.initKlinesDatabase(symbol, timeframe);
  }

  private async handleAlgo(responseInRange: Kline[], query): Promise<Kline[]> {
    const { algorithm, fast, slow, signal, length, periodOpen, periodClose, threshold, streak, user } = query;

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
      case 'deepTrend':
        return this.tensorflow.setSignals(responseInRange);
      case 'flashCrash':
        return this.flashCrash.setSignals(responseInRange);
      case 'dca':
        return this.dca.setSignals(responseInRange);
      case 'martingale':
        return this.martingale.setSignals(responseInRange, Number(threshold));
      case 'twitterSentiment':
        return await this.twitterSentiment.setSignals(responseInRange, user);
      default: throw 'invalid';
    }
  }
}