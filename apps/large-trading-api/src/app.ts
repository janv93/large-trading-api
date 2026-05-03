import config from 'config';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import Base from './base';
import Routes from './controllers/routes';
import database from './data/database';
import alpaca from './controllers/exchanges/alpaca';

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
    this.app.post('/klinesWithAlgorithm', this.handle((req, res) => this.routes.getKlinesWithAlgorithm(req, res)));
    this.app.post('/multi', this.handle((req, res) => this.routes.runMultiTicker(req, res)));
    this.app.get('/trade', this.handle((req, res) => this.routes.tradeStrategy(req, res)));
    this.app.post('/backtest', this.handle((req, res) => this.routes.postBacktestData(req, res)));
    this.app.post('/indicators', this.handle((req, res) => this.routes.postTechnicalIndicator(req, res)));
  }

  private handle(fn: (req: Request, res: Response) => void | Promise<void>) {
    return async (req: Request, res: Response): Promise<void> => {
      this.log(req.originalUrl);

      try {
        await fn(req, res);
      } catch (err) {
        const origin = err instanceof Error ? err.stack?.split('\n')[1]?.trim() : undefined;
        this.log(`Error on ${req.originalUrl}: ${err}${origin ? ` (${origin})` : ''}`);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  private startServer(): Promise<Server> {
    return new Promise((resolve) => {
      const server: Server = this.app.listen((config as any).port, () => {
        resolve(server);
      });
    });
  }

  public async start(): Promise<void> {
    this.log('Initializing App');

    const [serverStarted, totalDeleted, stockSplitCleanup]: [Server, (number | null), void] = await Promise.all([
      this.startServer(),
      database.deleteOutdatedKlines(),
      alpaca.deleteStockSplitSymbols()
    ]);

    if (totalDeleted) {
      this.log(`${totalDeleted} outdated klines deleted`);
    }

    const addressInfo: AddressInfo = serverStarted.address() as AddressInfo;
    const address: string = addressInfo.address === '::' ? 'localhost' : addressInfo.address;
    const port: number = addressInfo.port;

    this.log(`Server is listening on ${address}:${port}`);
    this.log('App initialized');
  }
}

const myApp = new App();
myApp.start();
