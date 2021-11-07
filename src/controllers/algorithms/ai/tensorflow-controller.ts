import BaseController from '../../base-controller';
// import * as tf from '@tensorflow/tfjs-node-gpu';    // GPU
import * as tf from '@tensorflow/tfjs-node';   // CPU

export default class TensorflowController extends BaseController {
  constructor() {
    super();
    this.run();
  }

  run() {
    const dataX: Array<any> = []
    const dataY: Array<any> = [];

    for (let i = 0; i < 10; i++) {
      const num1 = Math.floor(Math.random() * 10);
      const num2 = Math.floor(Math.random() * 10);
      const sum = num1 + num2;

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
    model.add(tf.layers.dense({ units: 4, inputShape: [2] }))
    model.add(tf.layers.dense({ units: 10, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 10, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));

    // Compiling the model
    model.compile({
      optimizer: 'adam',
      loss: 'meanAbsoluteError',
      metrics: ['mae']
    });

    const dataTestX = [[3, 5], [15.3, 0.5]];
    const testX = tf.tensor(dataTestX);
    testX.print();

    // Fitting the model
    model.fit(x, y, {
      batchSize: 100,
      epochs: 500
    }).then((history) => {
      // printing loss and predictions
      console.log((model.predict(testX) as any).dataSync())
    });
  }
}