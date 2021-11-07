import BaseController from '../../base-controller';
import * as tf from '@tensorflow/tfjs-node-gpu';

export default class TensorflowController extends BaseController {
  constructor() {
    super();
    this.run();
  }

  run() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const dataX: Array<any> = []
    const dataY: Array<any> = [];
    const dataZ: Array<any> = [];

    dataZ.push([[8]],[[7.3]],[[9.6]]);

    // Creating the data
    for (let i = 0; i < alphabet.length - 1; i++) {
      dataX.push([[i+1]]);

      // One-hot-encoding the output values
      let arr = new Array(alphabet.length).fill(0)
      arr[alphabet.indexOf(alphabet.charAt(i + 1))] = 1;
      dataY.push(arr);
    }

    // Transforming the data to tensors
    const x = tf.tensor(dataX);
    const y = tf.tensor(dataY);
    const z = tf.tensor(dataZ);

    // Printing the tensors
    z.print()

    // Creating the RNN Model
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 48, inputShape: [1, 1] }))
    model.add(tf.layers.dense({ units: 2000, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2000, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2000, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2000, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2000, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2000, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2000, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2000, activation: 'relu' }));
    model.add(tf.layers.dense({ units: alphabet.length, activation: 'softmax' }));

    // Compiling the model
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Fitting the model
    model.fit(x, y, {
      batchSize: alphabet.length,
      epochs: 50
    }).then((history) => {
      // printing loss and predictions
      console.log((model.predict(z) as any).argMax(1).dataSync())
    });
  }
}