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
}

export interface KlinePrices {
  open: number;
  close: number;
  high: number;
  low: number;
}