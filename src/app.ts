import express from 'express';
import config from 'config';
import Database from './data/db';
import BinanceController from './controllers/binance-controller';

const app = express();


app.get('/', (req, res) => {
  const bc = new BinanceController();
  bc.getKlinesMultiple('BTCUSDT', 3).then((response: any) => {
    res.send(response);
  });
});

app.listen(config.port, () => {
  console.log('Server is listening on port ' + config.port);
});