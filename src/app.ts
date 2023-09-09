require('dotenv').config();
import express from 'express';
import config from 'config';
import Routes from './controllers/routes';

const app = express();
const routes = new Routes();

app.use(express.json({limit: '50mb'}));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/klinesWithAlgorithm', (req, res) => {
  console.log('/klinesWithAlgorithm');
  routes.getKlinesWithAlgorithm(req, res);
});

app.get('/multi', (req, res) => {
  console.log('/multi');
  routes.runMultiTicker(req, res);
});

app.get('/trade', (req, res) => {
  console.log('/trade');
  routes.tradeStrategy(req, res);
});

app.post('/backtest', (req, res) => {
  console.log('/backtest');
  routes.postBacktestData(req, res);
});

app.post('/indicators', (req, res) => {
  console.log('/indicators');
  routes.postTechnicalIndicator(req, res);
});

app.listen(config.port, () => {
  console.log('Server is listening on port ' + config.port);
});