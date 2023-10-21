export interface Kline {
  times: Times;
  prices: Prices;
  volume: number;
  numberOfTrades: number;
  signal?: string;
  percentProfit?: number;
  amount?: number;
};

export interface Times {
  open: number;
  close: number;
}

export interface Prices {
  open: number;
  close: number;
  high: number;
  low: number;
}

export interface Klines {
  klines: Kline[];
  commission: number;
  flowingProfit: boolean;
}

export interface BacktestStats {
  ppa: string;
  profit: string;
  trades: number;
  positiveNegative: string;
  drawbackProfitRatio: string;
  maxDrawback: string;
}