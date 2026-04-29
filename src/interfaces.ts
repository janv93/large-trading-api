import { LinearFunction } from './controllers/algorithms/patterns/linear-function';

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
  DeepTrend = 'DEEPTREND',
  Bb = 'BB',
  Dca = 'DCA',
  MeanReversion = 'MEANREVERSION',
  TrendLine = 'TRENDLINE',
  MarketStructure = 'MARKETSTRUCTURE',
  Example = 'EXAMPLE'
}

export enum PivotPointSide {
  High = 'HIGH',
  Low = 'LOW'
}

export enum Signal {
  // these are set in the backtests
  Buy = 'BUY',
  Sell = 'SELL',
  Close = 'CLOSE',  // close a specific position
  CloseAll = 'CLOSEALL',  // close all open positions
  // these are only set by the backtester
  Liquidation = 'LIQUIDATION',
  TakeProfit = 'TAKEPROFIT',
  StopLoss = 'STOPLOSS'
}

export enum Slope {
  Ascending = 'ASC',
  Descending = 'DESC'
}

export enum TrendLinePosition {
  Above = 'ABOVE',
  Below = 'BELOW'
}

export enum LogLevel {
  Default = 'DEFAULT',
  NoDb = 'NODB'
}

export enum MarketStructureType {
  HH = 'HH',
  HL = 'HL',
  LH = 'LH',
  LL = 'LL'
}

export enum Direction {
  Up = 'UP',
  Down = 'DOWN'
}

export interface AppConfig {
  lastOutdatedKlineRemoval: Date,
  hadStockSplitCleanup?: boolean
}

export interface KlineWithIndex {
  kline: Kline;
  index: number;
}

export interface Kline {
  symbol: string;
  timeframe: Timeframe;
  times: KlineTimes;
  prices: KlinePrices;
  volume: number;
  algorithms: Partial<Record<Algorithm, BacktestData>>;
  numberOfTrades?: number;
  tweets?: Tweet[];
  chart?: KlineChart;
}

export interface KlineTimes {
  open: number;
  close?: number;
}

export interface KlinePrices {
  open: number;
  close: number;
  high: number;
  low: number;
}

export interface KlineChart {
  pivotPoint?: PivotPoint;
  marketStructure?: MarketStructureStats;
  trendLines?: TrendLine[]; // trend lines that start from this kline
  trendLineBreakthroughs?: TrendLine[];  // trend lines that break through this kline
}

export interface PivotPoint {
  space: number;
  side: PivotPointSide;
  marketStructure?: MarketStructureType;
}

export interface MarketStructureStats {
  streak: number; // # higher or lower in a row
  direction: Direction;
}

export interface TrendLine {
  function: LinearFunction;
  startIndex: number;
  endIndex: number;
  breakThroughIndex?: number;
  length: number;
  slope: Slope;
  position: TrendLinePosition;
  againstTrend: boolean;
}

// information for backtest and calculated backtest data
export interface BacktestData {
  signals: BacktestSignal[];  // allow multiple independent signals for multiple independent positions
  percentProfit?: number; // calculated profit at current kline
  openPositionSize?: number;  // calculated position size open at current kline
}

export interface BacktestSignal {
  signal: Signal;
  price: number;
  size?: number;  // not required if close
  positionCloseTrigger?: PositionCloseTrigger;
  openSignalReferences?: SignalReference[];  // only for closes to refer to the position which is closed, currently only used be the frontend
}

export interface SignalReference {
  klineIndex: number;
  signalIndex: number;
}

export interface PositionCloseTrigger {
  tpSl?: TakeProfitStopLoss;
  tSl?: TrailingStopLoss;
}

export interface TakeProfitStopLoss {
  takeProfit: number;
  stopLoss: number;
}

export interface TrailingStopLoss {
  stopLoss: number; // if percentOfProfit is set, this serves as minimum stopLoss
  percentOfProfit?: number; // use percent of peak profit as stop loss
}

export interface MultiBenchmark {
  tickers: Kline[][];
  score: number;
  averageProfit: number;
  params?: MultiBenchmarkParams;
}

// custom params for each algorithm
export interface MultiBenchmarkParams {
  threshold?: number;
  profitBasedTrailingStopLoss?: number;
}

export interface AlpacaResponse {
  nextPageToken: string;
  klines: Kline[];
}

export interface Tweet {
  time: number;
  id: number;
  text: string;
  symbols: TweetSymbol[];
}

export interface TweetSymbol {
  symbol: string;
  originalSymbol: string;
  price?: number; // price at time of tweet
  sentiment?: number;
}

export interface TwitterUser {
  name: string;
  id: string;
  followers: number;
  following: number;
}

export interface TwitterTimeline {
  id: string;
  tweets: Tweet[];
}

export interface TweetSentiment {
  id: number;
  symbol: string;
  model: string;
  sentiment: number;
}

export interface StockInfo {
  symbol: string;
  country: string;
  sector: string;
  cap: number;
}

export interface Position {
  size: number; // current size, changing - positive means long, negative short
  entrySize: number; // size at entry, does not change
  price: number;
  entryPrice: number;
  highestPrice?: number; // optional because we can't evaluate intra kline if the high was reached after the entryPrice
  lowestPrice?: number; // as above
  liquidationPrice: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  openSignalReference: SignalReference;
}