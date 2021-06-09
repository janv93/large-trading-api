import express from 'express';
import bodyParser from 'body-parser';
import config from 'config';
import RoutesController from './controllers/routes-controller';

const app = express();
const routesController = new RoutesController();

app.use(bodyParser.json({ limit: '50mb' }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/klines', (req, res) => {
  routesController.getKlines(req, res);
});

app.get('/klinesWithAlgorithm', (req, res) => {
  routesController.getKlinesWithAlgorithm(req, res);
});

app.post('/backtest', (req, res) => {
  routesController.postBacktestData(req, res);
});

app.post('/indicators', (req, res) => {
  routesController.postTechnicalIndicator(req, res);
});

app.listen(config.port, () => {
  console.log('Server is listening on port ' + config.port);
});