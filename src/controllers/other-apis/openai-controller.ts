import axios from 'axios';
import BaseController from '../base-controller';


export default class OpenAi extends BaseController {
  private baseUrl = 'https://api.openai.com/v1';

  private headers = {
    'Authorization': `Bearer ${process.env.openai_secret}`
  };

  public async complete(prompt: string) {
    const url = this.baseUrl + '/completions';

    const finalPrompt = `The following tweet will contain one or multiple crypto tokens. 
I want you to analyze the tweet thoroughly and return a sentiment for each tweeted token. A token is identified by a preceding "$". The tweet may be posted by an experienced trader or an absolute beginner. 
The sentiment has to be one of the 3 words: "bullish" if the sentiment for the token is bullish, "bearish" if the sentiment is bearish or "neutral" if the tweet does not express a prediction or the direction of the prediction cannot be defined. 
The format of your response must be:\n\n
"$[token symbol]: [sentiment]\n
$[next token symbol]: [sentiment]"\n\n
Remember to only answer in this format. This is the tweet:\n\n
"${prompt}"\n\n
Your answer:`

    console.log(finalPrompt)

    const body = {
      model: 'text-davinci-003',
      prompt: finalPrompt,
      max_tokens: 50,
      temperature: 0,
      top_p: 1,
      n: 1,
      stream: false,
      logprobs: null
    };

    try {
      const res = await axios.post(url, body, { headers: this.headers });
      console.log(res.data.choices[0].text);
    } catch (err) {
      this.handleError(err);
    }
  }
}