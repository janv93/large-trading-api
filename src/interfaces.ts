export interface Kline {
  symbol: string;
  timeframe: string;
  times: KlineTimes;
  prices: KlinePrices;
  volume: number;
  numberOfTrades?: number;
  signal?: string;
  percentProfit?: number;
  amount?: number;
  tweets?: Tweet[];
};

export interface KlineTimes {
  open: number;
  close?: number;
};

export interface KlinePrices {
  open: number;
  close: number;
  high: number;
  low: number;
};

export interface MultiBenchmark {
  tickers: Kline[][];
  score: number;
  averageProfit: number;
  params?: MultiBenchmarkParams;
};

// custom params for each algorithm
export interface MultiBenchmarkParams {
  threshold?: number;
  profitBasedTrailingStopLoss?: number;
};

export interface AlpacaResponse {
  nextPageToken: string;
  klines: Kline[];
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

export interface TwitterUser {
  name: string;
  id: string;
  followers: number;
  following: number;
};

export interface TwitterTimeline {
  id: string;
  tweets: Tweet[];
};

export interface TweetSentiment {
  id: number;
  symbol: string;
  model: string;
  sentiment: number;
};

export interface StockInfo {
  symbol: string;
  country: string;
  sector: string;
  cap: number;
};