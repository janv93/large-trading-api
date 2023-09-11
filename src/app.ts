require('dotenv').config();
import express, { Request, Response, NextFunction } from 'express';
import config from 'config';
import Routes from './controllers/routes';
import Base from './controllers/base';

class App extends Base {
  public app: express.Application;
  private routes: Routes;

  constructor() {
    super();
    this.app = express();
    this.routes = new Routes();
    this.config();
    this.route();
  }

  private config(): void {
    this.app.use(express.json({ limit: '50mb' }));

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  private route(): void {
    this.app.get('/klinesWithAlgorithm', (req, res) => {
      this.log(req.originalUrl, this);
      this.routes.getKlinesWithAlgorithm(req, res);
    });
    this.app.get('/multi', (req, res) => {
      this.log(req.originalUrl, this);
      this.routes.runMultiTicker(req, res);
    });
    this.app.get('/trade', (req, res) => {
      this.log(req.originalUrl, this);
      this.routes.tradeStrategy(req, res);
    });
    this.app.post('/backtest', (req, res) => {
      this.log(req.originalUrl, this);
      this.routes.postBacktestData(req, res);
    });
    this.app.post('/indicators', (req, res) => {
      this.log(req.originalUrl, this);
      this.routes.postTechnicalIndicator(req, res);
    });
  }

  public start(): void {
    this.app.listen(config.port, () => {
      console.log();
      this.log(`Server is listening on port ${config.port}`, this);
    });
  }
}

const myApp = new App();
myApp.start();
