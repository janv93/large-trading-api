import Logger from './controllers/logger';

export default class Base {
  private logger = new Logger();
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

  protected forEachWithProgress(arr: any[], callback: (item: any, index: number) => void): void {
    arr.forEach((item, index) => {
      this.logProgress((index + 1) / arr.length * 100);
      callback(item, index);
    });
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
