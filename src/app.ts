import express from 'express';
import config from 'config';
import RoutesController from './controllers/routes-controller';

const app = express();
const routesController = new RoutesController();

app.get('/klines', (req, res) => {
  routesController.getKlines(req, res);
});

app.listen(config.port, () => {
  console.log('Server is listening on port ' + config.port);
});