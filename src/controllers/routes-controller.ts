import BinanceController from './binance-controller';
import PivotReversalController from './algorithms/pivot-reversal-controller';
import MomentumController from './algorithms/momentum-controller';
import BacktestController from './algorithms/backtest-controller';
import IndicatorsController from './technical-analysis/indicators-controller';
import MacdController from './algorithms/macd-controller';

export default class RoutesController {
  private binanceController: BinanceController;
  private pivotReversalController: PivotReversalController;
  private momentumController: MomentumController;
  private backtestController: BacktestController;
  private indicatorsController: IndicatorsController;
  private macdController: MacdController;

  constructor() {
    this.binanceController = new BinanceController();
    this.pivotReversalController = new PivotReversalController();
    this.momentumController = new MomentumController();
    this.backtestController = new BacktestController();
    this.indicatorsController = new IndicatorsController();
    this.macdController = new MacdController();
  }

  /**
   * get list of klines / candlesticks from binance
   */
  public getKlines(req, res): void {
    this.binanceController.getKlinesMultiple(req.query.symbol, req.query.times)
      .then((response: any) => {
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

    this.binanceController.getKlinesMultiple(query.symbol, query.times)
      .then((response: any) => {
        let klinesWithSignals: Array<any> = [];

        switch(query.algorithm) {
          case 'pivotReversal':
            klinesWithSignals = this.pivotReversalController.setSignals(response, Number(query.leftBars), Number(query.rightBars));
            break;
          case 'momentum':
            klinesWithSignals = this.momentumController.setSignals(response, query.streak);
            break;
          case 'macd':
            klinesWithSignals = this.macdController.setSignals(response, query.fast, query.slow, query.signal);
            break;
        }
        
        if (klinesWithSignals.length > 0) {
          res.send(klinesWithSignals);
        } else {
          res.send('Algorithm "' + query.algorithm + '" does not exist');
        }
      });
  }

  public postBacktestData(req, res): void {
    const performance = this.backtestController.calcBacktestPerformance(req.body, req.query.commission, req.query.type);
    res.send(performance);
  }

  public postTechnicalIndicator(req, res): void {
    const query = req.query;
    let indicatorChart: Array<any> = [];

    switch (query.indicator) {
      case 'rsi': indicatorChart = this.indicatorsController.rsi(req.body, query.length); break;
      case 'macd': indicatorChart = this.indicatorsController.macd(req.body, query.fast, query.slow, query.signal); break;
    }

    if (indicatorChart.length > 0) {
      res.send(indicatorChart);
    } else {
      res.send('Indicator "' + query.indicator + '" does not exist');
    }
  }
}