export interface Snapshot {
  symbol: string;
  timeframe: string;
  klines: Kline[];
};

export interface Kline {
  times: KlineTimes;
  prices: KlinePrices;
  volume: number;
  numberOfTrades?: number;
  signal?: string;
  percentProfit?: number;
  amount?: number;
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

export interface Tweet {
  time: number;
  id: number;
  text: string;
  symbols: string[];
};

export interface TwitterUser {
  name: string;
  id: string;
  followers: number;
  following: number;
};

export interface TwitterTimeline {
  name: string;
  tweets: Tweet[];
};