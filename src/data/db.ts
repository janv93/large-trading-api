const Datastore = require('nedb');
const db = new Datastore({ filename: 'src/data/candlesticks.db' });
db.loadDatabase();

export default class Database {
  public insert(key, value) {
    const newInsert = {};
    newInsert[key] = value;
    db.insert(newInsert);
  }

  public async findAll() {
    return await new Promise((res, rej) => {
      db.find({}, (err, docs) => {
        if (err) {
          rej(err);
        } else {
          res(docs);
        }
      });
    });
  }
}
