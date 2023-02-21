import axios from 'axios';
import BaseController from '../base-controller';
import database from '../../data/database';
import { Tweet, TweetSymbol } from '../../interfaces';


export default class OpenAi extends BaseController {
  private baseUrl = 'https://api.openai.com/v1';
  private database = database;
  private model = 'text-davinci-003'; // CAREFUL - high cost - set usage limits

  private headers = {
    'Authorization': `Bearer ${process.env.openai_secret}`
  };

  public async getSentiments(tweets: Tweet[]): Promise<Tweet[]> {
    const promises: Promise<Tweet>[] = tweets.map(async (tweet) => {
      const symbolPromises: Promise<TweetSymbol>[] = tweet.symbols.map((symbol) => this.getSentiment(tweet, symbol));
      const symbols = await Promise.all(symbolPromises);
      tweet.symbols = symbols;
      return tweet;
    });

    return Promise.all(promises);
  }

  public async getSentiment(tweet: Tweet, symbol: TweetSymbol): Promise<TweetSymbol> {
    const dbSentiment = await this.database.getTweetSymbolSentiment(tweet.id, symbol.symbol, this.model);

    if (dbSentiment.length) { // in database
      return { symbol: symbol.symbol, sentiment: dbSentiment };
    } else {  // not in database, make call
      const sentiment = await this.postCompletion(tweet, symbol.symbol);
      return { symbol: symbol.symbol, sentiment };
    }
  }

  // https://platform.openai.com/docs/api-reference/completions
  public async postCompletion(tweet: Tweet, symbol: string): Promise<string> {
    const url = this.baseUrl + '/completions';
    const body = {
      model: this.model, // https://platform.openai.com/docs/models/gpt-3
      prompt: this.createSentimentPrompt(tweet.text, symbol), // single string or array of strings
      max_tokens: 10, // max response tokens
      temperature: 0, // randomness, 0 = none, 2 = max
      top_p: 1, // alternative to temperature, filters output tokens by probability, 0.1 = only top 10% of tokens
      n: 1, // amount of responses/completions for 1 prompt
      stream: false, // real time stream
      logprobs: null // returns probability for each response token
    };

    try {
      const res = await axios.post(url, body, { headers: this.headers });
      const sentiment = res.data.choices.map(c => c.text)[0];
      const sentimentFormatted = sentiment.replace(/[\n\s]/g, '').toLowerCase();
      const mappedSentiment = ['bull', 'bear'].includes(sentimentFormatted) ? sentimentFormatted : 'neutral';
      await this.database.writeTweetSymbolSentiments([{ id: tweet.id, symbol: symbol, model: this.model, sentiment: mappedSentiment, text: tweet.text }]); // save sentiment in database
      return mappedSentiment;
    } catch (err) {
      this.handleError(err);
      return '';
    }
  }

  private createSentimentPrompt(tweet: string, symbol: string): string {
    return `The following tweet contains the crypto currency symbol ${symbol}. 
The goal is to get the sentiment of the author in order to understand where the author sees its value in the future (sentiment analysis). 
Analyze the tweet and return a sentiment for ${symbol}. 
The sentiment is a string of either "bull" if the prediction is bullish, "bear" if the prediction is bearish, or "neutral" if the prediction is neutral or a prediction cannot be clearly determined. 
The tweet is:\n\n
"${tweet}"\n\n
Sentiment: `;
  }
}