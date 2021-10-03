export interface BinanceKucoinKline {
  times: BinanceKucoinTimes;
  prices: BinanceKucoinPrices;
  volume: number;
  numberOfTrades?: number;
  signal?: string;
  percentProfit?: number;
};

export interface BinanceKucoinTimes {
  open: number;
  close: number;
}

export interface BinanceKucoinPrices {
  open: number;
  close: number;
  high: number;
  low: number;
}