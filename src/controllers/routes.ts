import database from '../data/database';
import Base from './base';
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
import { Kline } from '../interfaces';

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

  public async initKlines(req, res): Promise<void> {
    let exchange;

    switch (req.query.exchange) {
      case 'binance': exchange = this.binance; break;
      case 'kucoin': exchange = this.kucoin; break;
      case 'alpaca': exchange = this.alpaca; break;
    }

    const response = await exchange.initKlinesDatabase(req.query.symbol, req.query.timeframe);
    res.send(response);
  }

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
   * get list of klines / candlesticks from binance and add buy and sell signals
   * 
   * algorithm is delivered through query parameter 'algorithm'
   * depending on algorithm, additional query params may be necessary
   */
  public async getKlinesWithAlgorithm(req, res): Promise<void> {
    const query = req.query;

    try {
      const response = await this.database.getKlines(query.symbol, query.timeframe);
      const responseInRange = response.slice(-1000 * Number(query.times));    // get last times * 1000 timeframes
      let klinesWithSignals = this.handleAlgoSync(responseInRange, query);

      if (!klinesWithSignals || !klinesWithSignals.length) {
        klinesWithSignals = await this.handleAlgoAsync(responseInRange, req.query);
      }

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

  private handleAlgoSync(responseInRange: Kline[], query): Kline[] {
    let klinesWithSignals: Kline[] = [];
    const { algorithm, fast, slow, signal, length, periodOpen, periodClose, threshold, streak } = query;

    switch (algorithm) {
      case 'momentum':
        klinesWithSignals = this.momentum.setSignals(responseInRange, streak);
        break;
      case 'macd':
        klinesWithSignals = this.macd.setSignals(responseInRange, fast, slow, signal);
        break;
      case 'rsi':
        klinesWithSignals = this.rsi.setSignals(responseInRange, Number(length));
        break;
      case 'ema':
        klinesWithSignals = this.ema.setSignals(responseInRange, Number(periodOpen), Number(periodClose));
        break;
      case 'emasl':
        klinesWithSignals = this.ema.setSignalsSL(responseInRange, Number(periodClose));
        break;
      case 'bb':
        klinesWithSignals = this.bb.setSignals(responseInRange, Number(length));
        break;
      case 'deepTrend':
        klinesWithSignals = this.tensorflow.setSignals(responseInRange);
        break;
      case 'flashCrash':
        klinesWithSignals = this.flashCrash.setSignals(responseInRange);
        break;
      case 'dca':
        klinesWithSignals = this.dca.setSignals(responseInRange);
        break;
      case 'martingale':
        klinesWithSignals = this.martingale.setSignals(responseInRange, Number(threshold));
        break;
    }

    return klinesWithSignals;
  }

  private async handleAlgoAsync(responseInRange, query): Promise<Kline[]> {
    switch (query.algorithm) {
      case 'twitterSentiment':
        return await this.twitterSentiment.setSignals(responseInRange, query.user);
      default: throw 'invalid';
    }
  }
}