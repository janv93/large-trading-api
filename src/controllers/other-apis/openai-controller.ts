import axios from 'axios';
import BaseController from '../base-controller';
import database from '../../data/database';
import { Tweet, TweetSymbol } from '../../interfaces';


export default class OpenAi extends BaseController {
  private baseUrl = 'https://api.openai.com/v1';
  private database = database;
  // CAREFUL - high cost - set usage limits
  // text-ada-001, text-babbage-001, text-curie-001, text-davinci-003
  private model = 'text-curie-001';

  private headers = {
    'Authorization': `Bearer ${process.env.openai_secret}`
  };

  public async getSentiments(tweets: Tweet[]): Promise<Tweet[]> {
    const tweetsWithSentiments = await Promise.all(tweets.map(async (tweet) => {
      tweet.symbols = await Promise.all(tweet.symbols.map((symbol) => this.getSentiment(tweet, symbol)));
      return tweet;
    }));

    const sentiments = tweetsWithSentiments.flatMap(t => t.symbols.map(s => ({ id: t.id, symbol: s.symbol, model: this.model, sentiment: s.sentiment! })));
    this.database.writeTweetSentiments(sentiments); // bulk write to prevent concurrent writes on same timelines

    return tweetsWithSentiments;
  }

  public async getSentiment(tweet: Tweet, symbol: TweetSymbol): Promise<TweetSymbol> {
    const dbSentiment = await this.database.getTweetSentiment(tweet.id, symbol.symbol, this.model);

    if (dbSentiment) { // in database
      return { symbol: symbol.symbol, originalSymbol: symbol.originalSymbol, sentiment: dbSentiment };
    } else {  // not in database, make call
      const sentiment = await this.postCompletionChat(tweet, symbol.originalSymbol);
      return { symbol: symbol.symbol, originalSymbol: symbol.originalSymbol, sentiment };
    }
  }

  // https://platform.openai.com/docs/api-reference/completions
  public async postCompletion(tweet: Tweet, symbol: string): Promise<number> {
    const url = this.baseUrl + '/completions';

    const body = {
      model: this.model, // https://platform.openai.com/docs/models/gpt-3
      prompt: this.createSentimentPromptScale(tweet.text, symbol), // single string or array of strings
      max_tokens: 10, // max response tokens
      temperature: 0, // randomness, 0 = none, 2 = max
      top_p: 1, // alternative to temperature, filters output tokens by probability, 0.1 = only top 10% of tokens
      n: 1, // amount of responses/completions for 1 prompt
      stream: false, // real time stream
      logprobs: null // returns probability for each response token
    };

    try {
      console.log('POST ' + url);
      const res = await axios.post(url, body, { headers: this.headers });
      const sentiment = res.data.choices[0].text;
      const numbers = sentiment.match(/\d+/g);
      const sentimentNumber = numbers?.length && numbers?.length === 1 ? parseInt(numbers[0]) : -1;
      const sentimentInRange = 0 < sentimentNumber && sentimentNumber < 11 ? sentimentNumber : 5;
      return sentimentInRange;
    } catch (err) {
      this.handleError(err);
      return 0;
    }
  }

  // https://platform.openai.com/docs/api-reference/chat
  public async postCompletionChat(tweet: Tweet, symbol: string): Promise<number> {
    const url = this.baseUrl + '/chat/completions';

    const messages = [
      { role: 'system', content: 'You are an AI language model that specializes in sentiment analysis of crypto twitter.' },
      { role: 'user', content: this.createSentimentPromptScale(tweet.text, symbol) },
    ]

    const body = {
      model: 'gpt-3.5-turbo', // https://platform.openai.com/docs/models/gpt-3
      messages, // single string or array of strings
      max_tokens: 10, // max response tokens
      temperature: 0, // randomness, 0 = none, 2 = max
      top_p: 1, // alternative to temperature, filters output tokens by probability, 0.1 = only top 10% of tokens
      n: 1, // amount of responses/completions for 1 prompt
      stream: false, // real time stream
      presence_penalty: 2 // punishment for repeated tokens
    };

    try {
      console.log('POST ' + url);
      const res = await axios.post(url, body, { headers: this.headers });
      const sentiment = res.data.choices[0].message.content;
      const numbers = sentiment.match(/\d+/g);
      const sentimentNumber = numbers?.length && numbers?.length === 1 ? parseInt(numbers[0]) : -1;
      const sentimentInRange = 0 < sentimentNumber && sentimentNumber < 11 ? sentimentNumber : 5;
      return sentimentInRange;
    } catch (err) {
      this.handleError(err);
      return 0;
    }
  }

  private createSentimentPromptClassify(tweet: string, symbol: string): string {
    return `The following tweet contains the crypto currency symbol ${symbol}. 
The goal is to get the sentiment of the author in order to understand where the author sees its value in the future (sentiment analysis). 
Analyze the tweet and return a sentiment for ${symbol}. 
The sentiment is a string of either "bull" if the prediction is bullish, "bear" if the prediction is bearish, or "neutral" if the prediction is neutral or a prediction cannot be clearly determined. 
It is important to return "neutral" when there is uncertainty about a direction. 
The tweet is:\n\n
"${tweet}"\n\n
Sentiment: `;
  }

  private createSentimentPromptScale(tweet: string, symbol: string): string {
    return `The following tweet contains the crypto currency symbol ${symbol}.
The goal is to get the sentiment of the author in order to understand where the author sees its value in the future (sentiment analysis).
The tweet is:\n\n
"${tweet}"\n\n
Analyze the tweet and return a sentiment for ${symbol}.
The sentiment is a number from 1 to 10 where 1 is the most bearish and 10 is the most bullish. If a prediction cannot be determined or the sentiment is neutral, return 5.
Only output the number from 1 to 10.
Sentiment: `
  }
}