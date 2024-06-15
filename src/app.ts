import config from 'config';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import Base from './controllers/base';
import Routes from './controllers/routes';
import database from './data/database';

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
    this.app.post('/klinesWithAlgorithm', (req, res) => {
      this.log(req.originalUrl);
      this.routes.getKlinesWithAlgorithm(req, res);
    });

    this.app.post('/multi', (req, res) => {
      this.log(req.originalUrl);
      this.routes.runMultiTicker(req, res);
    });

    this.app.get('/trade', (req, res) => {
      this.log(req.originalUrl);
      this.routes.tradeStrategy(req, res);
    });

    this.app.post('/backtest', (req, res) => {
      this.log(req.originalUrl);
      this.routes.postBacktestData(req, res);
    });

    this.app.post('/indicators', (req, res) => {
      this.log(req.originalUrl);
      this.routes.postTechnicalIndicator(req, res);
    });
  }

  private startServer(): Promise<Server> {
    return new Promise((resolve) => {
      const server: Server = this.app.listen(config.port, () => {
        resolve(server);
      });
    });
  }

  public async start(): Promise<void> {
    this.log('Initializing App');

    const [serverStarted, totalDeleted]: [Server, number] = await Promise.all([
      this.startServer(),
      database.deleteOutdatedKlines()
    ]);

    this.log(`${totalDeleted} outdated klines deleted`);

    const addressInfo: AddressInfo = serverStarted.address() as AddressInfo;
    const address: string = addressInfo.address === '::' ? 'localhost' : addressInfo.address;
    const port: number = addressInfo.port;

    this.log(`Server is listening on ${address}:${port}`);
    this.log('App initialized');
  }
}

const myApp = new App();
myApp.start();
