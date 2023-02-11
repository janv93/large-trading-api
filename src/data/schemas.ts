import mongoose from 'mongoose';

export const KlineSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    index: true
  },
  timeframe: {
    type: String,
    required: true,
    index: true
  },
  openPrice: {
    type: Number,
    required: true
  },
  closePrice: {
    type: Number,
    required: true
  },
  highPrice: {
    type: Number,
    required: true
  },
  lowPrice: {
    type: Number,
    required: true
  },
  openTime: {
    type: Number,
    required: true,
    index: true
  },
  closeTime: {
    type: Number,
    required: false
  },
  volume: {
    type: Number,
    required: true
  },
  numberOfTrades: {
    type: Number,
    required: false
  }
});