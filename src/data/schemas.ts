import mongoose from 'mongoose';

export const KlinePricesSchema = new mongoose.Schema({
  open: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: true
  },
  high: {
    type: Number,
    required: true
  },
  low: {
    type: Number,
    required: true
  }
});

export const KlineTimesSchema = new mongoose.Schema({
  open: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: false
  },
});

export const KlineSchema = new mongoose.Schema({
  times: {
    type: KlineTimesSchema,
    required: true
  },
  prices: {
    type: KlinePricesSchema,
    required: true
  },
  volume: {
    type: Number,
    required: true
  },
  numberOfTrades: {
    type: Number,
    required: false
  },
  signal: {
    type: String,
    required: false
  },
  percentProfit: {
    type: Number,
    required: false
  },
  amount: {
    type: Number,
    required: false
  }
});

export const SnapshotSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  timeframe: {
    type: String,
    required: true
  },
  klines: [{
    type: KlineSchema,
    required: true
  }]
});
