export enum Exchange {
  Binance = 'BINANCE',
  Kucoin = 'KUCOIN',
  Alpaca = 'ALPACA',
  BTSE = 'BTSE'
}

export enum Timeframe {
   _1Minute = '1m',
   _5Minutes = '5m',
   _15Minutes = '15m',
   _30Minutes = '30m',
   _1Hour = '1h',
   _2Hours = '2h',
   _4Hours = '4h',
   _6Hours = '6h',
   _8Hours = '8h',
   _12Hours = '12h',
   _1Day = '1d',
   _3Days = '3d',
   _1Week = '1w',
   _1Month = '1M',
   _3Months = '3M',
   _6Months = '6M'
}

export enum Algorithm {
  Momentum = 'MOMENTUM',
  Macd = 'MACD',
  Rsi = 'RSI',
  Ema = 'EMA',
  EmaSl = 'EMASL',
  DeepTrend = 'DEEPTREND',
  Bb = 'BB',
  FlashCrash = 'FLASHCRASH',
  Dca = 'DCA',
  MeanReversion = 'MEANREVERSION',
  TwitterSentiment = 'TWITTERSENTIMENT',
  TrendLine = 'TRENDLINE'
}

export interface Kline {
  symbol: string;
  timeframe: Timeframe;
  times: KlineTimes;
  prices: KlinePrices;
  volume: number;
  algorithms: Partial<Record<Algorithm, Backtest>>;
  numberOfTrades?: number;
  tweets?: Tweet[];
  chart?: KlineChart;
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

export interface Backtest {
  signal?: Signal;
  percentProfit?: number;
  amount?: number;
};

export interface KlineChart {
  pivotPoints?: PivotPoint[];
  trendLines?: TrendLine[];
};

export interface PivotPoint {
  left: number;
  right: number;
  side: PivotPointSide;
};

export enum PivotPointSide {
  High = 'HIGH',
  Low = 'LOW'
};

export interface TrendLine {
  endIndex: number;
  length: number;
  slope: Slope;
  position: Position;
};

export enum Slope {
  Ascending = 'ASC',
  Descending = 'DESC'
};

export enum Position {
  Above = 'ABOVE',
  Below = 'BELOW'
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