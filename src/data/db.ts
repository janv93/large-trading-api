const Datastore = require('nedb');
const db = new Datastore({ filename: 'src/data/storage/candlesticks.db' });
db.loadDatabase();

export default class Database {
  public insert(value) {
    db.insert(value);
  }

  public async findAll() {
    return new Promise((resolve, reject) => {
      db.find({}, (err, docs) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs);
        }
      });
    });
  }

}
