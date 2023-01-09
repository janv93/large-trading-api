import express from 'express';
import config from 'config';
import RoutesController from './controllers/routes-controller';
import dotenv from 'dotenv';
if (dotenv) { dotenv.config(); }

const app = express();
const routesController = new RoutesController();

app.use(express.json({limit: '50mb'}));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/initKlines', (req, res) => {
  console.log('/initKlines');
  routesController.initKlines(req, res);
});

app.get('/klines', (req, res) => {
  console.log('/klines');
  routesController.getKlines(req, res);
});

app.get('/klinesWithAlgorithm', (req, res) => {
  console.log('/klinesWithAlgorithm');
  routesController.getKlinesWithAlgorithm(req, res);
});

app.get('/trade', (req, res) => {
  console.log('/trade');
  routesController.tradeStrategy(req, res);
});

app.post('/backtest', (req, res) => {
  console.log('/backtest');
  routesController.postBacktestData(req, res);
});

app.post('/indicators', (req, res) => {
  console.log('/indicators');
  routesController.postTechnicalIndicator(req, res);
});

app.listen(config.port, () => {
  console.log('Server is listening on port ' + config.port);
});