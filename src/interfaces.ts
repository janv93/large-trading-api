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
  timestamp: number;
  id: number;
  text: string;
  hashtags?: Array<string>;
  symbols?: Array<string>;
  urls?: Array<string>;
  user: string;
  userId: number;
  userFollowers: number;
  userFollowing: number;
};