import BinanceController from './binance-controller';
import PivotReversalController from './algorithms/pivot-reversal-controller';
import MomentumController from './algorithms/momentum-controller';
import BacktestController from './algorithms/backtest-controller';

export default class RoutesController {
  private binanceController: BinanceController;
  private pivotReversalController: PivotReversalController;
  private momentumController: MomentumController;
  private backtestController: BacktestController;

  constructor() {
    this.binanceController = new BinanceController();
    this.pivotReversalController = new PivotReversalController();
    this.momentumController = new MomentumController();
    this.backtestController = new BacktestController();
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
    this.binanceController.getKlinesMultiple(req.query.symbol, req.query.times)
      .then((response: any) => {
        let enrichedKlines: Array<any> = [];

        switch(req.query.algorithm) {
          case 'pivotReversal':
            enrichedKlines = this.pivotReversalController.setSignals(response, Number(req.query.leftBars), Number(req.query.rightBars));
            break;
          case 'momentum':
            enrichedKlines = this.momentumController.setSignals(response, req.query.streak);
            break;
        }
        
        if (enrichedKlines.length > 0) {
          res.send(enrichedKlines);
        } else {
          res.send('Algorithm ' + req.query.algorithm + ' does not exist');
        }
      });
  }

  public postBacktestData(req, res): void {
    const performance = this.backtestController.calcBacktestPerformance(req.body, req.query.commission);
    res.send(performance);
  }
}