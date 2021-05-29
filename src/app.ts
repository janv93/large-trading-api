const express = require('express');
const config = require('config');
const app = express();

app.get('/', (req, res) => {
  res.send('test');
});

app.listen(config.port, () => {
  console.log('Server is listening on port ' + config.port);
});