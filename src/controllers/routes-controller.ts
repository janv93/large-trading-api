import Database from '../data/db';
import BaseController from './base-controller';
import AlpacaController from './exchanges/alpaca-controller';
import BinanceController from './exchanges/binance-controller';
import KucoinController from './exchanges/kucoin-controller';
import MomentumController from './algorithms/momentum-controller';
import BacktestController from './algorithms/backtest-controller';
import IndicatorsController from './technical-analysis/indicators-controller';
import MacdController from './algorithms/macd-controller';
import RsiController from './algorithms/rsi-controller';
import EmaController from './algorithms/ema-controller';
import BbController from './algorithms/bb-controller';
import TensorflowController from './algorithms/ai/tensorflow-controller';
import FlashCrashController from './algorithms/flash-crash-controller';
import DcaController from './algorithms/investing/dca-controller';
import MartingaleController from './algorithms/investing/martingale-controller';
import TwitterSentimentController from './algorithms/sentiment/twitter-sentiment-controller';
import { Kline } from '../interfaces';

export default class RoutesController extends BaseController {
  private database = new Database();
  private alpaca = new AlpacaController();
  private binance = new BinanceController();
  private kucoin = new KucoinController();
  private indicatorsController = new IndicatorsController();
  private momentumController = new MomentumController();
  private backtestController = new BacktestController();
  private macdController = new MacdController();
  private rsiController = new RsiController();
  private emaController = new EmaController();
  private bbController = new BbController();
  private tensorflowController = new TensorflowController();
  private flashCrashController = new FlashCrashController();
  private dcaController = new DcaController();
  private martingaleController = new MartingaleController();
  private twitterSentimentController = new TwitterSentimentController();

  public async initKlines(req, res): Promise<void> {
    let controller;

    switch (req.query.exchange) {
      case 'binance': controller = this.binance; break;
      case 'kucoin': controller = this.kucoin; break;
      case 'alpaca': controller = this.alpaca; break;
    }

    const response = await controller.initKlinesDatabase(req.query.symbol, req.query.timeframe);
    res.send(response);
  }

  /**
   * get list of klines / candlesticks from binance
   */
  public async getKlines(req, res): Promise<void> {
    let controller;

    switch (req.query.exchange) {
      case 'binance': controller = this.binance; break;
      case 'kucoin': controller = this.kucoin; break;
      case 'alpaca': controller = this.alpaca; break;
    }

    const response = await controller.getKlinesMultiple(req.query.symbol, req.query.times, req.query.timeframe);
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
      const response = await this.database.findKlines(query.symbol, query.timeframe);
      const responseInRange = response[0].klines.slice(-1000 * Number(query.times));    // get last times * 1000 timeframes
      let klinesWithSignals;

      if (klinesWithSignals && klinesWithSignals.length > 0) {
        klinesWithSignals = this.handleAlgoSync(responseInRange, req.query);
      } else {
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
    const performance = this.backtestController.calcBacktestPerformance(req.body, req.query.commission, this.stringToBoolean(req.query.flowingProfit));
    res.send(performance);
  }

  public tradeStrategy(req, res): void {
    switch (req.query.strategy) {
      case 'ema': this.emaController.trade(req.query.symbol, req.query.open ? true : false);
    }

    res.send('Running');
  }

  public postTechnicalIndicator(req, res): void {
    const query = req.query;
    const { indicator, length, fast, slow, signal, period } = query;
    let indicatorChart: any[] = [];

    switch (indicator) {
      case 'rsi': indicatorChart = this.indicatorsController.rsi(req.body, Number(length)); break;
      case 'macd': indicatorChart = this.indicatorsController.macd(req.body, Number(fast), Number(slow), Number(signal)); break;
      case 'ema': indicatorChart = this.indicatorsController.ema(req.body, Number(period)); break;
      case 'bb': indicatorChart = this.indicatorsController.bb(req.body, Number(period)); break;
      default: res.send(`Indicator "${indicator}" does not exist`); return;
    }

    res.send(indicatorChart);
  }

  private handleAlgoSync(responseInRange: Kline[], query): Kline[] {
    let klinesWithSignals: Kline[] = [];
    const { algorithm, fast, slow, signal, length, periodOpen, periodClose, threshold, streak } = query;

    switch (algorithm) {
      case 'momentum':
        klinesWithSignals = this.momentumController.setSignals(responseInRange, streak);
        break;
      case 'macd':
        klinesWithSignals = this.macdController.setSignals(responseInRange, fast, slow, signal);
        break;
      case 'rsi':
        klinesWithSignals = this.rsiController.setSignals(responseInRange, Number(length));
        break;
      case 'ema':
        klinesWithSignals = this.emaController.setSignals(responseInRange, Number(periodOpen), Number(periodClose));
        break;
      case 'emasl':
        klinesWithSignals = this.emaController.setSignalsSL(responseInRange, Number(periodClose));
        break;
      case 'bb':
        klinesWithSignals = this.bbController.setSignals(responseInRange, Number(length));
        break;
      case 'deepTrend':
        klinesWithSignals = this.tensorflowController.setSignals(responseInRange);
        break;
      case 'flashCrash':
        klinesWithSignals = this.flashCrashController.setSignals(responseInRange);
        break;
      case 'dca':
        klinesWithSignals = this.dcaController.setSignals(responseInRange);
        break;
      case 'martingale':
        klinesWithSignals = this.martingaleController.setSignals(responseInRange, Number(threshold));
        break;
    }

    return klinesWithSignals;
  }

  private async handleAlgoAsync(responseInRange, query): Promise<Kline[]> {
    switch (query.algorithm) {
      case 'twitterSentiment':
        return await this.twitterSentimentController.setSignals(responseInRange, query.user);
      default: throw 'invalid';
    }
  }
}