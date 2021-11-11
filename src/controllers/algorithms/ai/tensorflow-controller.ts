import BaseController from '../../base-controller';
import { BinanceKucoinKline } from '../../../interfaces';

// import * as tf from '@tensorflow/tfjs-node-gpu';    // GPU
import * as tf from '@tensorflow/tfjs-node';   // CPU

export default class TensorflowController extends BaseController {
  constructor() {
    super();
    // this.test();
  }

  test() {
    const dataX: Array<any> = [];
    const dataY: Array<any> = [];

    for (let i = 0; i < 100; i++) {
      const num1 = Math.floor(Math.random() * 20);
      const num2 = Math.floor(Math.random() * 20);
      const sum = num1 * num2;

      dataX.push([num1, num2]);
      dataY.push(sum);
    }

    // Transforming the data to tensors
    const x = tf.tensor(dataX);
    const y = tf.tensor(dataY);

    x.print();
    y.print();

    // Creating the Model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 4, inputShape: [2], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 10, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 20, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 40, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 40, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 20, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 10, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'relu' }));

    // Compiling the model
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    const dataTestX = [[3, 5], [15.3, 7.5]];
    const testX = tf.tensor(dataTestX);

    // Fitting the model
    model.fit(x, y, {
      batchSize: 100,
      epochs: 1000,
      validationSplit: 0.5
    }).then((history) => {
      // printing loss and predictions
      console.log((model.predict(testX) as any).dataSync())
    });
  }

  public setSignals(klines: Array<BinanceKucoinKline>): Array<BinanceKucoinKline> {
    const samples = this.createTrendTrainingData(klines);

    const dataX: Array<any> = samples.map(sample => sample.trainingData);
    const dataY: Array<any> = samples.map(sample => sample.trend).map(sample => [sample.bearish, sample.bullish]);

    // Transforming the data to tensors
    const x = tf.tensor(dataX);
    const y = tf.tensor(dataY);

    x.print();
    y.print();

    // Creating the Model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 200, inputShape: [100], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 400, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 400, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 200, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 100, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 10, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2, activation: 'relu' }));

    // Compiling the model
    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: [tf.metrics.binaryCrossentropy]
    });

    // Fitting the model
    model.fit(x, y, {
      batchSize: 100,
      epochs: 100,
      validationSplit: 0.5
    }).then((history) => {
      // printing loss and predictions
      // console.log((model.predict(testX) as any).dataSync())
      console.log('done');
    });

    return klines;
  }

  /**
   * create a training data set with inputs and outputs
   */
  private createTrendTrainingData(klines: Array<BinanceKucoinKline>): Array<any> {
    const closes = klines.map(kline => kline.prices.close);
    const normalizedCloses = this.normalize(closes);
    const trendLength = 50;
    const trainingLength = trendLength * 2;
    const sampleLength = trainingLength + trendLength;
    const samples: Array<any> = [];

    for (let i = 0; i < normalizedCloses.length - sampleLength; i++) {
      const trainingData = normalizedCloses.slice(i, i + trainingLength);
      const trendData = normalizedCloses.slice(i + trainingLength, i + trainingLength + trendLength);
      const trend = this.getTrend(trainingData[trainingData.length - 1], trendData);
      const sample = { trainingData, trend };
      samples.push(sample);
    }

    return samples;
  }

  /**
   * calculates if the trend is up or down compared to the last price of the training data set
   */
  private getTrend(lastPrice: number, trendData: Array<number>): any {
    const minClose = Math.min(...trendData);
    const maxClose = Math.max(...trendData);
    const threshold = 0.05;
    const minPercent = minClose < lastPrice ? (lastPrice - minClose) / lastPrice : 0;
    const maxPercent = maxClose > lastPrice ? (maxClose - lastPrice) / lastPrice : 0;
    const bearish = minPercent > threshold ? 1 : 0;
    const bullish = maxPercent > threshold ? 1 : 0;

    return { bearish, bullish };
  }

  /**
   * normalize data to values between 0 and 1
   */
  private normalize(closes: Array<number>): Array<number> {
    const minClose = Math.min(...closes);
    const maxClose = Math.max(...closes);
    const range = maxClose - minClose;

    return closes.map(close => (close - minClose) / range);
  }
}