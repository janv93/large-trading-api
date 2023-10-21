export interface Kline {
  symbol: string;
  timeframe: string;
  times: Times;
  prices: Prices;
  volume: number;
  numberOfTrades?: number;
  signal?: string;
  percentProfit?: number;
  amount?: number;
  tweets?: Tweet[];
};

export interface Times {
  open: number;
  close: number;
};

export interface Prices {
  open: number;
  close: number;
  high: number;
  low: number;
};

export interface Tweet {
  time: number;
  id: number;
  text: string;
  symbols: TweetSymbol[];
};

export interface TweetSymbol {
  symbol: string;
  originalSymbol: string;
  price?: number; // price at time of tweet
  sentiment?: number;
};

export interface Klines {
  klines: Kline[];
  commission: number;
  flowingProfit: boolean;
};

export interface BacktestStats {
  profitPerAmount: string;
  profit: string;
  numberOfTrades: number;
  positiveNegative: string;
  drawbackProfitRatio: string;
  maxDrawback: string;
};