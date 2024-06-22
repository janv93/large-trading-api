import axios from 'axios';
import Base from '../../base';
import database from '../../data/database';
import { Tweet, TweetSymbol } from '../../interfaces';


export default class OpenAi extends Base {
  private baseUrl = 'https://api.openai.com/v1';
  private database = database;
  // CAREFUL - high cost - set usage limits
  // completion: text-ada-001, text-babbage-001, text-curie-001, text-davinci-003
  // chat completion: gpt-3.5-turbo
  private model = 'gpt-3.5-turbo';

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
      const sentiment = await this.postCompletionChat(tweet, symbol.originalSymbol, symbol.price!);
      return { symbol: symbol.symbol, originalSymbol: symbol.originalSymbol, sentiment };
    }
  }

  // https://platform.openai.com/docs/api-reference/completions
  public async postCompletion(tweet: Tweet, symbol: string, price): Promise<number> {
    const url = this.baseUrl + '/completions';

    const body = {
      model: this.model, // https://platform.openai.com/docs/models/gpt-3
      prompt: this.createSentimentPromptScale(tweet.text, symbol, price), // single string or array of strings
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
  public async postCompletionChat(tweet: Tweet, symbol: string, price: number): Promise<number> {
    const url = this.baseUrl + '/chat/completions';

    const messages = [
      { role: 'system', content: 'You are an AI language model that specializes in sentiment analysis of crypto twitter.' },
      { role: 'user', content: this.createSentimentPromptScale(tweet.text, symbol, price) },
    ];

    const body = {
      model: this.model,
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

  private createSentimentPromptScale(tweet: string, symbol: string, price: number): string {
    return `Analyze the sentiment of a tweet for the cryptocurrency symbol ${symbol}, priced at ${Math.floor(price)}$, assessing the author's view of ${symbol}'s short-term future value. 
If there are multiple predictions, only consider the soonest. 
The tweet reads:
"${tweet}"
Assign a sentiment score to ${symbol} on a 1-10 scale, where 1 is highly bearish and 10 is highly bullish. If you're unable to determine a perfectly clear direction, return a score of 5. 
Only output the number.
Sentiment: `;
  }
}