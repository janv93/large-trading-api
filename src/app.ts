import express from 'express';
import config from 'config';
import Database from './data/db';

const app = express();


app.get('/', (req, res) => {
  const db = new Database();
  db.insert({ test: 'test123' });
  db.findAll().then(res => {
    console.log(res);
  });
  res.send('inserted');
});

app.listen(config.port, () => {
  console.log('Server is listening on port ' + config.port);
});