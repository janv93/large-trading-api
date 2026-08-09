import Logger from './logger';

export default class Base {
  private logger = new Logger();
  private stepsDone = 0;
  private stepsTotal = 0;
  public silent = false;

  protected log(...args: any[]): void {
    this.logger.log(...args, this.constructor.name);
  }

  protected logErr(...args: any[]): void {
    this.logger.logErr(...args, this.constructor.name);
  }

  protected logProgress(percent: number): void {
    if (this.silent) return;
    this.logger.logProgress(percent, this.constructor.name);
  }

  /** every phase counts one step per bar it walks, so no phase needs a weight of its own */
  protected startProgress(totalSteps: number): void {
    this.stepsTotal = totalSteps;
    this.stepsDone = 0;
    this.logProgress(0);
  }

  protected addProgress(steps: number): void {
    if (!this.stepsTotal) return;
    this.stepsDone += steps;
    this.logProgress(Math.min(99, this.stepsDone / this.stepsTotal * 100)); // only endProgress may reach 100, which clears the bar
  }

  protected endProgress(): void {
    this.stepsTotal = 0;
    this.logProgress(100);
  }

  protected handleError(err: any, symbol?: string): void {
    if (symbol) {
      this.logErr('Error received for symbol ' + symbol + ':');
    }

    if (err.response && err.response.data) {
      this.logErr(err.response.data);
    } else {
      this.logErr(err);
    }
  }
}
