import BaseController from '../base-controller';
import plotly from 'plotly';

export default class PlotlyController extends BaseController {
  private _plotly = new plotly(process.env.plotly_username, process.env.plotly_api_key);

  public plot(sequence: number[]) {
    const data = { y: sequence, type: 'scatter' };
    const layout = { fileopt: "overwrite", filename: "LTAPI simple plot" };

    this.draw(data, layout);
  }

  public plotPredictions(inputs: number[][], predictions: number[], outputUnits: number) {
    const mergedInputs: number[] = inputs.map(input => input[0]);
    const lastInput = inputs[inputs.length - 1]
    mergedInputs.push(...lastInput.slice(1, lastInput.length));

    const data = [{
      x: Array.from(Array(mergedInputs.length).keys()),
      y: mergedInputs,
      type: 'scatter',
      marker: { color: 'rgb(0, 0, 0)' }
    }];

    const layout = { fileopt: "overwrite", filename: "LTAPI multi plot" };

    const splittedPredictions: number[][] = [];
    let samplePredictions: number[] = [];

    predictions.forEach((prediction, i) => {
      const isSplit = i % outputUnits === outputUnits - 1;

      if (!isSplit) {
        samplePredictions.push(prediction);
      } else {
        samplePredictions.push(prediction);
        splittedPredictions.push(samplePredictions);
        samplePredictions = [];
      }
    });

    splittedPredictions.forEach((predictions, i) => {
      const x = Array.from(Array(outputUnits).keys()).map(el => el + inputs[0].length + i);

      const dataSample = {
        x,
        y: predictions,
        type: 'scatter',
        marker: { color: 'rgb(0, 0, 255)' }
      };

      data.push(dataSample);
    });

    this.draw(data, layout);
  }

  private draw(data, layout) {
    this._plotly.plot(data, layout, (err, msg) => {
      if (err) {
        console.log('Error while plotting');
        return console.log(err);
      }

      console.log('Plotting done');
    });
  }

}