import { LinearFunction } from './linear-function';

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
  Momentum = 'momentum',
  Macd = 'macd',
  Rsi = 'rsi',
  Ema = 'ema',
  Bb = 'bb',
  Dca = 'dca',
  MeanReversion = 'meanReversion',
  TrendLineBreakthrough = 'trendLineBreakthrough',
  MarketStructure = 'marketStructure',
  RsiDivergence = 'rsiDivergence',
  Example = 'example',
  CandlestickPatterns = 'candlestickPatterns'
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

export enum CloseType {
  Close = 'CLOSE',
  StopLoss = 'STOPLOSS',
  TakeProfit = 'TAKEPROFIT',
  Liquidation = 'LIQUIDATION'
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

export interface AlgorithmConfig {
  single: Record<string, any>;
  multi?: Record<string, AlgorithmConfigMulti>;
}

export interface AlgorithmConfigMulti {
  min: number;
  max: number;
  step?: number;
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

export enum RsiDivergenceType {
  Bullish = 'BULLISH',             // price LL, RSI higher low → potential reversal up
  Bearish = 'BEARISH',             // price HH, RSI lower high → potential reversal down
  HiddenBullish = 'HIDDEN_BULLISH', // price HL, RSI lower low → trend continuation up
  HiddenBearish = 'HIDDEN_BEARISH'  // price LH, RSI higher high → trend continuation down
}

export interface AppConfig {
  lastOutdatedBarRemoval: Date;
  hadStockSplitCleanup?: boolean;
}

export interface BarWithIndex {
  bar: Bar;
  index: number;
}

export interface Bar {
  symbol: string;
  timeframe: Timeframe;
  times: BarTimes;
  prices: BarPrices;
  volume: number;
  algorithms: Partial<Record<Algorithm, BacktestData>>;
  numberOfTrades?: number;
  tweets?: Tweet[];
  chart?: BarChart;
  indicators?: BarIndicators;
  candlestickPatterns?: BarCandlestickPatterns;
}

export interface BarTimes {
  open: number;
  close?: number;
}

export interface BarPrices {
  open: number;
  close: number;
  high: number;
  low: number;
}

export interface BarChart {
  pivotPoint?: PivotPoint;
  marketStructure?: MarketStructureStats;
  trendLines?: TrendLine[]; // trend lines that start from this bar
  trendLineBreakthroughs?: TrendLine[];  // trend lines that break through this bar
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

export interface RsiDivergenceData {
  regular?: RsiDivergenceTypeWithStrength;
  hidden?: RsiDivergenceTypeWithStrength;
}

export interface RsiDivergenceTypeWithStrength {
  type: RsiDivergenceType;
  strength: number;
}

export interface BarIndicators {
  ema?: Record<number, number>;   // keyed by period, e.g. ema[20] = value
  sma?: Record<number, number>;   // keyed by period, e.g. sma[50] = value
  macd?: MacdValues;
  rsi?: number;
  bb?: BollingerBands;
  atr?: number;
  rsiDivergence?: RsiDivergenceData;
}

export interface BarCandlestickPatterns {
  // single-candle
  doji?: boolean;
  hammer?: boolean;
  hangingMan?: boolean;
  invertedHammer?: boolean;
  shootingStar?: boolean;
  bullishMarubozu?: boolean;
  bearishMarubozu?: boolean;
  spinningTop?: boolean;
  // two-candle
  bullishEngulfing?: boolean;
  bearishEngulfing?: boolean;
  bullishHarami?: boolean;
  bearishHarami?: boolean;
  piercingLine?: boolean;
  darkCloudCover?: boolean;
  tweezersTop?: boolean;
  tweezersBottom?: boolean;
  // three-candle
  morningStar?: boolean;
  eveningStar?: boolean;
  threeWhiteSoldiers?: boolean;
  threeBlackCrows?: boolean;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdValues {
  macdLine: number;
  signal: number;
  histogram: number;
}

export interface TrendLine {
  function: LinearFunction;
  startIndex: number;
  endIndex: number;
  breakThroughIndex?: number;
  length: number;
  slope: Slope;
  position: TrendLinePosition;
  againstTrend?: boolean;
}

// information for backtest and calculated backtest data
export interface BacktestData {
  signals: BacktestSignal[];  // allow multiple independent signals for multiple independent positions
  profit?: number; // calculated profit at current bar
  openPositionSize?: number;  // calculated position size open at current bar
}

export interface BacktestSignal {
  signal: Signal;
  price: number;
  size?: number;  // not required if close
  positionCloseTrigger?: PositionCloseTrigger;
  openSignalReferences?: SignalReference[];  // only for closes to refer to the position which is closed
}

export interface SignalReference {
  barIndex: number;
  signalIndex: number;
}

export interface PositionCloseTrigger {
  tpSl?: TakeProfitStopLoss;
  tSl?: TrailingStopLoss;
}

export interface TakeProfitStopLoss {
  takeProfit: number;
  stopLoss: number;
  asVolatilityFactor?: boolean;  // if true, tp/sl are multiplied by (ATR / price) at entry — requires ATR indicator to be calculated
}

export interface TrailingStopLoss {
  stopLoss: number; // if percentOfProfit is set, this serves as minimum stopLoss
  percentOfProfit?: number; // use percent of peak profit as stop loss
}

export interface MultiBenchmark {
  score: number;
  params?: MultiBenchmarkParams;
}

// custom params for each algorithm
export type MultiBenchmarkParams = Record<string, number>;

export interface AlpacaResponse {
  nextPageToken: string;
  bars: Bar[];
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
  highestPrice?: number; // optional because we can't evaluate intra bar if the high was reached after the entryPrice
  lowestPrice?: number; // as above
  liquidationPrice: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  openSignalReference: SignalReference;
}

export interface Run {
  bars: Bar[];
  commission: number;
}

export interface BacktestStats {
  profit: number; // 1 = 100%
  numberOfTrades: number;
  maxDrawback: number;
}

export interface TickerMetrics {
  sqrtProfit: number;
  maxDrawdownRatio: number;
  signalCount: number;
}
