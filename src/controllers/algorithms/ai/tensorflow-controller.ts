import BaseController from '../../base-controller';
import { BinanceKucoinKline } from '../../../interfaces';
import PlotlyController from '../../plotly-controller';

// import * as tf from '@tensorflow/tfjs-node-gpu';    // GPU
import * as tf from '@tensorflow/tfjs-node';   // CPU

export default class TensorflowController extends BaseController {
  private plotlyController = new PlotlyController();

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
    console.log('Received ' + klines.length + ' klines');

    // this.trainModelPriceToPrice(klines);
    this.trainModelPriceDiffToPriceDiff(klines);

    return klines;
  }

  /**
   * train model on inputs and outputs as price
   */
  private trainModelPriceToPrice(klines: Array<BinanceKucoinKline>) {
    const inputCount = 5;
    const outputCount = 1;
    const samples = this.createTrainingDataPriceToPrice(klines, inputCount, outputCount);

    // create inputs and outputs
    const dataX: Array<any> = samples.map(sample => sample.inputs);
    const dataY: Array<any> = samples.map(sample => sample.outputs);
    const dataTestX: Array<any> = dataX.slice(-10);

    // transforming the data to tensors
    const x = tf.tensor(dataX);
    const y = tf.tensor(dataY);
    const testX = tf.tensor(dataTestX);

    x.print();
    y.print();

    const activation = undefined;

    // creating the Model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 100, inputShape: [inputCount], activation }));
    model.add(tf.layers.dense({ units: outputCount, activation }));

    // compiling the model
    model.compile({
      optimizer: tf.train.adam(),
      loss: tf.losses.meanSquaredError,
      metrics: [tf.metrics.meanAbsoluteError]
    });

    // fitting the model
    model.fit(x, y, {
      batchSize: 100,
      epochs: 100,
      validationSplit: 0.9,
      callbacks: tf.node.tensorBoard('log')
    }).then((history) => {
      console.log();
      console.log('### Training finished ###');
      console.log();

      // printing loss and predictions
      const predictions = (model.predict(testX) as any).dataSync();
      testX.print();
      console.log(predictions);
      this.plotlyController.plotPredictions(dataTestX, predictions, outputCount);
    });
  }

  /**
   * train model on inputs and outputs as price diff to previous kline
   */
  private trainModelPriceDiffToPriceDiff(klines: Array<BinanceKucoinKline>) {
    const inputCount = 5;
    const outputCount = 1;
    const samples = this.createTrainingDataPriceDiffToPriceDiff(klines, 5, 1);

    // create inputs and outputs
    const dataX: Array<any> = samples.map(sample => sample.inputs);
    const dataY: Array<any> = samples.map(sample => sample.outputs);
    const dataTestX: Array<any> = dataX.slice(-10);

    // transforming the data to tensors
    const x = tf.tensor(dataX);
    const y = tf.tensor(dataY);
    const testX = tf.tensor(dataTestX);

    x.print();
    y.print();

    const activation = undefined;

    // creating the Model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 100, inputShape: [inputCount], activation }));
    model.add(tf.layers.dense({ units: outputCount, activation }));

    // compiling the model
    model.compile({
      optimizer: tf.train.adam(),
      loss: tf.losses.meanSquaredError,
      metrics: [tf.metrics.meanAbsoluteError]
    });

    // fitting the model
    model.fit(x, y, {
      batchSize: 100,
      epochs: 100,
      validationSplit: 0.9,
      callbacks: tf.node.tensorBoard('log')
    }).then((history) => {
      console.log();
      console.log('### Training finished ###');
      console.log();

      // printing loss and predictions
      const predictions = (model.predict(testX) as any).dataSync();
      testX.print();
      console.log(predictions);
      // this.plotlyController.plotPredictions(dataTestX, predictions, outputCount);
    });
  }

  /**
   * create a training data set with inputs and outputs
   */
  private createTrainingDataPriceToPrice(klines: Array<BinanceKucoinKline>, inputCount: number, outputCount: number): Array<any> {
    const closes = klines.map(kline => kline.prices.close);
    const normalizedCloses = this.normalize(closes);

    return this.createInputsOutputs(normalizedCloses, inputCount, outputCount);
  }

  /**
   * create a training data set with inputs and outputs as price diff to previous
   */
  private createTrainingDataPriceDiffToPriceDiff(klines: Array<BinanceKucoinKline>, inputCount: number, outputCount: number) {
    const closes = klines.map(kline => kline.prices.close);

    const diffs = closes.slice(-(closes.length - 1)).map((close, i) => {
      const previousClose = closes[i];
      const diff = close - previousClose;
      return diff / previousClose;
    });

    return this.createInputsOutputs(diffs, inputCount, outputCount);
  }

  /**
   * create samples from sequences in values
   */
  private createInputsOutputs(values: Array<number>, inputLength: number, outputLength: number): Array<any> {
    const samples: Array<any> = [];
    const totalLength = inputLength + outputLength;

    for (let i = 0; i < values.length - totalLength; i++) {
      const inputs = values.slice(i, i + inputLength);
      const outputs = values.slice(i + inputLength, i + inputLength + outputLength);
      const sample = { inputs, outputs };
      samples.push(sample);
    }

    return samples;
  }
}