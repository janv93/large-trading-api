import axios from 'axios';
import Base from '../base';
import fs from 'fs';
import { join } from 'path';
import { StockInfo } from '../../interfaces';


export default class Nasdaq extends Base {
  public getStocksByMarketCap(cap: number): StockInfo[] {
    const csvLines = fs.readFileSync('src/controllers/other-apis/nasdaq-all-stocks.csv', 'utf-8').split('\n');

    const stocks = csvLines.slice(1).map(l => {
      const columns = l.split(',');

      return {
        symbol: columns[0],
        cap: Number(columns[5]),
        country: columns[6],
        sector: columns[9]
      };
    });

    return stocks.filter(s => s.cap > cap);
  }
}