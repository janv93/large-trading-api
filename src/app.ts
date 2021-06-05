import express from 'express';
import config from 'config';
import RoutesController from './controllers/routes-controller';

const app = express();
const routesController = new RoutesController();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/klines', (req, res) => {
  routesController.getKlines(req, res);
});

app.get('/klinesWithAlgorithm', (req, res) => {
  routesController.getKlinesWithAlgorithm(req, res);
});

app.listen(config.port, () => {
  console.log('Server is listening on port ' + config.port);
});