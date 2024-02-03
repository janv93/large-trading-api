export interface Kline {
  symbol: string;
  timeframe: string;
  times: KlineTimes;
  prices: KlinePrices;
  volume: number;
  algorithms: Algorithms;
  numberOfTrades?: number;
  tweets?: Tweet[];
  chartData?: KlineChartData;
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

export interface Algorithms {
  momentum?: Backtest;
  macd?: Backtest;
  rsi?: Backtest;
  ema?: Backtest;
  emaSl?: Backtest;
  bb?: Backtest;
  flashCrash?: Backtest;
  dca?: Backtest;
  meanReversion?: Backtest;
  twitterSentiment?: Backtest;
  trendline?: Backtest;
};

export interface KlineChartData {
  pivotPoints?: PivotPoint[];
};

export interface PivotPoint {
  left: number;
  right: number;
  direction: PivotPointDirection;
};

export enum PivotPointDirection {
  High = 'HIGH',
  Low = 'LOW'
};

export interface Backtest {
  signal?: Signal;
  percentProfit?: number;
  amount?: number;
};

export enum Signal {
  Buy = 'BUY',
  CloseBuy = 'CLOSEBUY',  // a close followed by a buy signal
  Sell = 'SELL',
  CloseSell = 'CLOSESELL',
  Close = 'CLOSE'
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