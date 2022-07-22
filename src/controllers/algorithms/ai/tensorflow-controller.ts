import BaseController from '../../base-controller';
import { BinanceKucoinKline } from '../../../interfaces';
import PlotlyController from '../../plotly-controller';
import IndicatorsController from '../../technical-analysis/indicators-controller';

// import * as tf from '@tensorflow/tfjs-node-gpu';    // GPU
import * as tf from '@tensorflow/tfjs-node';   // CPU
import { data } from '@tensorflow/tfjs-node';

export default class TensorflowController extends BaseController {
  private plotlyController = new PlotlyController();
  private indicatorsController = new IndicatorsController();

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
    model.add(tf.layers.dense({ units: outputCount, inputShape: [inputCount], activation }));

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
    const inputCount = 10;
    const outputCount = 1;
    const samples = this.createTrainingDataPriceDiffToPriceDiff(klines, inputCount, outputCount);

    // create inputs and outputs
    const dataX: Array<any> = samples.map(sample => sample.inputs);
    const dataY: Array<any> = samples.map(sample => sample.outputs);
    const dataTestX: Array<any> = dataX.slice(-100);

    // transforming the data to tensors
    const x = tf.tensor(dataX);
    const y = tf.tensor(dataY);
    const testX = tf.tensor(dataTestX);

    x.print();
    y.print();

    const activation = 'relu';

    // creating the Model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 100, inputShape: [inputCount], activation }));
    model.add(tf.layers.dense({ units: 200, activation }));
    model.add(tf.layers.dense({ units: 200, activation }));
    model.add(tf.layers.dense({ units: outputCount }));

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

      const actual = dataTestX.map((input, i) => {
        console.log(dataTestX[i + 1])
        return dataTestX[i + 1] ? dataTestX[i + 1][inputCount - 1] : null;
      });

      const mappedData = this.mapInputsToPredictions(dataTestX, actual, predictions);
      console.log(mappedData);
      // this.plotlyController.plotPredictions(dataTestX, predictions, outputCount);


      // analyze actual vs prediction
      let correctPredictions = 0;
      let incorrectPredictions = 0;

      mappedData.forEach(data => {
        const overThreshold = data.prediction > 5 || data.prediction < -5;
        const bothNegative = data.actual < 0 && data.prediction < 0;
        const bothPositive = data.actual > 0 && data.prediction > 0;

        if (overThreshold) {
          if (bothNegative || bothPositive) {
            correctPredictions++;
          } else {
            incorrectPredictions++;
          }
        }
      });

      console.log(correctPredictions);
      console.log(incorrectPredictions);
    });
  }

  /**
   * train model on inputs as indicators and
   */
  private trainModelIndicatorsToPriceDiff(klines: Array<BinanceKucoinKline>) {
    const samples = this.createTrainingDataIndicatorsToPriceDiff(klines);

    // create inputs and outputs
    const dataX: Array<any> = samples.map(sample => [sample.inputs]);
    const dataY: Array<any> = samples.map(sample => sample.outputs);
    const dataTestX: Array<any> = dataX.slice(-100);

    // transforming the data to tensors
    const x = tf.tensor(dataX);
    const y = tf.tensor(dataY);
    const testX = tf.tensor(dataTestX);

    x.print();
    y.print();

    const activation = 'sigmoid';

    // creating the Model
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 30, inputShape: [1, 11], activation }));
    model.add(tf.layers.dense({ units: 30, activation }));
    model.add(tf.layers.dense({ units: 30, activation }));
    model.add(tf.layers.dense({ units: 1 }));

    // compiling the model
    model.compile({
      optimizer: tf.train.adam(0.00001),
      loss: tf.losses.meanSquaredError,
      metrics: [tf.metrics.meanAbsoluteError]
    });

    // fitting the model
    model.fit(x, y, {
      batchSize: 64,
      epochs: 200,
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
    });
  }

  private createTrainingDataIndicatorsToPriceDiff(klines: Array<BinanceKucoinKline>): Array<any> {
    // btc dominance?
    // fear and greed index?

    const rsiFull = this.indicatorsController.rsi(klines, 7);
    const macdFull = this.createDiffs(this.indicatorsController.macd(klines, 12, 26, 9).map(macd => macd.histogram), false, 0.1);
    const bbFull = this.indicatorsController.bb(klines, 21);
    const ema20Full = this.createDiffs(this.indicatorsController.ema(klines, 20).map(ema => ema.ema), true, 100);
    const ema50Full = this.createDiffs(this.indicatorsController.ema(klines, 50).map(ema => ema.ema), true, 100);
    const ema100Full = this.createDiffs(this.indicatorsController.ema(klines, 100).map(ema => ema.ema), true, 100);

    const maxLength = Math.min(rsiFull.length, macdFull.length, bbFull.length, ema20Full.length, ema50Full.length, ema100Full.length);

    const klinesInIndicatorRange = klines.slice(-maxLength);
    const rsi = rsiFull.slice(-maxLength);
    const macd = macdFull.slice(-maxLength);
    const bb = bbFull.slice(-maxLength);
    const ema20 = ema20Full.slice(-maxLength);
    const ema50 = ema50Full.slice(-maxLength);
    const ema100 = ema100Full.slice(-maxLength);

    const maxVolume = Math.max(...klinesInIndicatorRange.map(kline => kline.volume));

    const klinesWithIndicators = klinesInIndicatorRange.map((kline: BinanceKucoinKline, i: number) => {
      return {
        closeDiff: ((kline.prices.close - kline.prices.open) / kline.prices.open) * 10,   // price diff since opening, normalized
        highDiff: ((kline.prices.high - kline.prices.open) / kline.prices.open) * 10,
        lowDiff: ((kline.prices.low - kline.prices.open) / kline.prices.open) * 10,
        volume: kline.volume / maxVolume,   // relative volume
        rsi: rsi[i].rsi / 100,
        macd: macd[i],
        bbAbove: kline.prices.close > bb[i].bb.upper ? 1 : 0,   // one-hot-encoding for price > upper band
        bbBelow: kline.prices.close < bb[i].bb.lower ? 1 : 0,   // OHE for price < lower band
        ema20: ema20[i],
        ema50: ema50[i],
        ema100: ema100[i],
      };
    });

    klinesWithIndicators.pop(); // remove last element because of live data

    const samples = this.createInputsOutputs(klinesWithIndicators, 1, 1);
    const transformedSamples = this.transformIndicatorsSamples(samples);

    const s = transformedSamples.map(sample => Math.abs(sample.outputs[0]));
    const sum = s.reduce((a, b) => a + b, 0);
    const avg = (sum / s.length) || 0;

    console.log(avg);

    return transformedSamples;
  }

  /**
   * transform samples to inputs and outputs as arrays
   */
  private transformIndicatorsSamples(samples: Array<any>) {
    return samples.map(sample => {
      return {
        inputs: Object.values(sample.inputs[0]),
        outputs: [sample.outputs[0].closeDiff]
      }
    });
  }

  /**
   * create a training data set with inputs and outputs as price diff to previous
   */
  private createTrainingDataPriceDiffToPriceDiff(klines: Array<BinanceKucoinKline>, inputCount: number, outputCount: number): Array<any> {
    const closes = klines.map(kline => kline.prices.close);
    const diffs = this.createDiffs(closes, true, 100);

    return this.createInputsOutputs(diffs, inputCount, outputCount);
  }

  /**
   * creates an array of deltas between one value and its predecessor in percentage
   */
  private createDiffs(values: Array<number>, isPercentage: boolean, factor = 1): Array<number> {
    return values.slice(-(values.length - 1)).map((value, i) => {
      const previousValue = values[i];
      const diff = value - previousValue;

      if (isPercentage) {
        return (diff / previousValue) * factor;
      } else {
        return diff * factor;
      }
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
   * create samples from sequences in values
   */
  private createInputsOutputs(values: Array<any>, inputLength: number, outputLength: number): Array<any> {
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

  /**
   * map inputs to corresponding predictions
   */
  private mapInputsToPredictions(inputs: Array<any>, actual: Array<any>, predictions: Array<any>): Array<any> {
    return inputs.map((input: any, i: number) => {
      return { input, actual: actual[i], prediction: predictions[i] };
    });
  }

}