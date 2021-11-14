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

    const dataX: Array<any> = samples.map(sample => sample.trainingData.map(data => [data]));
    const dataY: Array<any> = samples.map(sample => sample.trendData);
    const dataTestX: Array<any> = dataX.slice(-10);

    // Transforming the data to tensors
    const x = tf.tensor(dataX);
    const y = tf.tensor(dataY);
    const testX = tf.tensor(dataTestX);

    x.print();
    y.print();

    // Creating the Model
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 128, inputShape: [10, 1], returnSequences: true }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.lstm({ units: 128, returnSequences: true }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.lstm({ units: 128 }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 1, activation: 'relu' }));


    // Compiling the model
    model.compile({
      optimizer: tf.train.adam(),
      loss: tf.losses.meanSquaredError,
      metrics: [tf.metrics.meanAbsoluteError]
    });

    // Fitting the model
    model.fit(x, y, {
      batchSize: 1000,
      epochs: 100,
      validationSplit: 0.9,
      callbacks: tf.node.tensorBoard('log')
    }).then((history) => {
      console.log();
      console.log('### Training finished ###');
      console.log();

      // printing loss and predictions
      // testX.print();
      // console.log((model.predict(testX) as any).dataSync());
    });

    return klines;
  }

  /**
   * create a training data set with inputs and outputs
   */
  private createTrendTrainingData(klines: Array<BinanceKucoinKline>): Array<any> {
    const closes = klines.map(kline => kline.prices.close);
    const normalizedCloses = this.normalize(closes);
    const trendLength = 1;
    const trainingLength = trendLength * 10;
    const sampleLength = trainingLength + trendLength;
    const samples: Array<any> = [];

    for (let i = 0; i < normalizedCloses.length - sampleLength; i++) {
      const trainingData = normalizedCloses.slice(i, i + trainingLength);
      const trendData = normalizedCloses.slice(i + trainingLength, i + trainingLength + trendLength);
      // const trend = this.getTrend(trainingData[trainingData.length - 1], trendData);
      const sample = { trainingData, trendData };
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
    const threshold = 0.01;
    const minPercent = minClose < lastPrice ? (lastPrice - minClose) / lastPrice : 0;
    const maxPercent = maxClose > lastPrice ? (maxClose - lastPrice) / lastPrice : 0;
    let bearish = minPercent > threshold ? 1 : 0;
    let bullish = maxPercent > threshold ? 1 : 0;

    const both = bearish && bullish;

    if (both) {
      bearish = 0;
      bullish = 0;
    }

    return { bearish, bullish };
  }
}