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

export const TweetSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    index: true
  },
  time: {
    type: Number,
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true
  },
  symbols: [{
    symbol: {
      type: String,
      required: true,
      index: true
    },
    originalSymbol: {
      type: String,
      required: true,
      index: true
    },
    sentiments: [{
      sentiment: {
        type: mongoose.Schema.Types.Mixed,  // number or string, depending on algo
        required: false,
        index: true
      },
      model: {
        type: String,
        required: false,
        index: true
      }
    }]
  }]
});

export const TwitterUserTimelineSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    index: true
  },
  tweets: [TweetSchema]
}, { timestamps: true });