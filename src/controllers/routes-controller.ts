import Database from '../data/db';
import BaseController from './base-controller';
import BinanceController from './binance-controller';
import MomentumController from './algorithms/momentum-controller';
import BacktestController from './algorithms/backtest-controller';
import IndicatorsController from './technical-analysis/indicators-controller';
import MacdController from './algorithms/macd-controller';
import RsiController from './algorithms/rsi-controller';
import EmaController from './algorithms/ema-controller';
import PatternComparatorController from './algorithms/ai/pattern-comparator-controller';

export default class RoutesController extends BaseController {
  private database = new Database();
  private binanceController = new BinanceController();
  private momentumController = new MomentumController();
  private backtestController = new BacktestController();
  private indicatorsController = new IndicatorsController();
  private macdController = new MacdController();
  private rsiController = new RsiController();
  private emaController = new EmaController();
  private patternComparatorController = new PatternComparatorController();

  constructor() {
    super();
  }

  public initKlines(req, res): void {
    this.binanceController.initKlinesDatabase(req.query.symbol, req.query.timeframe)
      .then(response => {
        res.send(response);
      });
  }

  /**
   * get list of klines / candlesticks from binance
   */
  public getKlines(req, res): void {
    this.binanceController.getKlinesMultiple(req.query.symbol, req.query.times, req.query.timeframe)
      .then(response => {
        res.send(response);
      });
  }

  /**
   * get list of klines / candlesticks from binance and add buy and sell signals
   * 
   * algorithm is delivered through query parameter 'algorithm'
   * depending on algorithm, additional query params may be necessary
   */
  public getKlinesWithAlgorithm(req, res): void {
    const query = req.query;
    this.database.findKlines(query.symbol, query.timeframe)
      .then((response: any) => {
        const responseInRange = response[0].klines.slice(-1000 * Number(query.times));    // get last times * 1000 timeframes
        let klinesWithSignals: Array<any> = [];

        switch(query.algorithm) {
          case 'momentum':
            klinesWithSignals = this.momentumController.setSignals(responseInRange, query.streak);
            break;
          case 'macd':
            klinesWithSignals = this.macdController.setSignals(responseInRange, query.fast, query.slow, query.signal);
            break;
          case 'rsi':
            klinesWithSignals = this.rsiController.setSignals(responseInRange, Number(query.length));
            break;
          case 'ema':
            klinesWithSignals = this.emaController.setSignals(responseInRange, Number(query.period));
            break;
          case 'patternCompare':
            klinesWithSignals = this.patternComparatorController.setSignals(responseInRange, Number(query.range));
            break;
        }
        
        if (klinesWithSignals.length > 0) {
          res.send(klinesWithSignals);
        } else {
          res.send('Algorithm "' + query.algorithm + '" does not exist');
        }
      }).catch(err => {
        this.handleError(err);
        res.status(500).json({ error: err.message });
      });
  }

  public postBacktestData(req, res): void {
    const performance = this.backtestController.calcBacktestPerformance(req.body, req.query.commission);
    res.send(performance);
  }

  public postTechnicalIndicator(req, res): void {
    const query = req.query;
    let indicatorChart: Array<any> = [];

    switch (query.indicator) {
      case 'rsi': indicatorChart = this.indicatorsController.rsi(req.body, Number(query.length)); break;
      case 'macd': indicatorChart = this.indicatorsController.macd(req.body, query.fast, query.slow, query.signal); break;
      case 'ema': indicatorChart = this.indicatorsController.ema(req.body, Number(query.period)); break;
    }

    if (indicatorChart.length > 0) {
      res.send(indicatorChart);
    } else {
      res.send('Indicator "' + query.indicator + '" does not exist');
    }
  }
}