import BinanceController from './binance-controller';
import PivotReversalController from './algorithms/pivot-reversal-controller';


export default class RoutesController {
  private binanceController: BinanceController;
  private pivotReversalController: PivotReversalController;

  constructor() {
    this.binanceController = new BinanceController();
    this.pivotReversalController = new PivotReversalController();
  }

  /**
   * get list of klines / candlesticks from binance
   */
  public getKlines(req, res) {
    this.binanceController.getKlinesMultiple(req.query.symbol, req.query.times)
      .then((response: any) => {
        res.send(response);
      });
  }

  /**
   * get list of klines / candlesticks from binance and add buy and sell signals
   * algorithm is delivered through query parameter 'algorithm'
   * depending on algorithm, additional query params may be necessary
   */
  public getKlinesWithAlgorithm(req, res) {
    this.binanceController.getKlinesMultiple(req.query.symbol, req.query.times)
      .then((response: any) => {
        let enrichedKlines: Array<any> = [];

        switch(req.query.algorithm) {
          case 'pivotReversal':
            enrichedKlines = this.pivotReversalController.setSignals(response, Number(req.query.leftBars), Number(req.query.rightBars));
        }
        
        if (enrichedKlines.length > 0) {
          res.send(enrichedKlines);
        } else {
          res.send('Algorithm' + req.query.algorithm + 'does not exist');
        }
      });
  }
}