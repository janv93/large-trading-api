import BinanceController from './binance-controller';


export default class RoutesController {
  private binanceController: BinanceController;

  constructor() {
    this.binanceController = new BinanceController();
  }

  getKlines(req, res) {
    this.binanceController.getKlinesMultiple(req.query.symbol, req.query.times)
      .then((response: any) => {
        res.send(response);
      });
  }
}