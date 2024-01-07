export interface Kline {
  symbol: string;
  timeframe: string;
  times: KlineTimes;
  prices: KlinePrices;
  volume: number;
  algorithms: Algorithms;
  numberOfTrades?: number;
  tweets?: Tweet[];
  metaData?: KlineMetaData;
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

export interface KlineMetaData {
  pivotPoint?: PivotPoint;
};

export enum PivotPoint {
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
  CloseBuy = 'CLOSEBUY',
  Sell = 'SELL',
  CloseSell = 'CLOSESELL',
  Close = 'CLOSE'
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
  profit: number;
  numberOfTrades: number;
  positive: number;
  negative: number;
  maxDrawback: number;
};