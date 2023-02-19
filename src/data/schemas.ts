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

export const TweetSymbolSentimentSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true,
    index: true
  },
  model: {
    type: String,
    required: true,
    index: true
  },
  sentiment: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  }
});