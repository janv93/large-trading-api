export interface BinanceKline {
  times: BinanceTimes;
  prices: BinancePrices;
  volume: number;
  numberOfTrades: number;
  signal?: string;
  percentProfit?: number;
};

export interface BinanceTimes {
  open: number;
  close: number;
}

export interface BinancePrices {
  open: number;
  close: number;
  high: number;
  low: number;
}