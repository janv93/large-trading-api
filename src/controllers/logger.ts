export default class Logger {
  private logLevel = 'nodb';

  private colors = {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
  };

  public log(...args: any[]) {
    const caller = args.pop();

    if (this.passesLogLevelCheck(caller)) {
      console.log(this.getParentLog(caller), ...args);
    }
  }

  public logErr(...args: any[]) {
    const caller = args.pop();

    if (this.passesLogLevelCheck(caller)) {
      console.error(`${this.getParentLog(caller)} ${this.colors.red}ERR${this.colors.reset}`, ...args);
    }
  }

  private getParentLog(caller: object) {
    const maxLength = 10;
    const callerName = caller.constructor.name;
    let color: string;

    switch (callerName) {
      case 'App':
        color = this.colors.blue;
        break;
      case 'Database':
        color = this.colors.yellow;
        break;
      case 'Alpaca':
        color = this.colors.cyan;
        break;
      case 'Binance':
      case 'Kucoin':
      case 'Btse':
        color = this.colors.magenta;
        break;
      default:
        color = this.colors.reset;
        break;
    }

    const paddedName = callerName.toUpperCase().padEnd(maxLength);
    return `${color}${paddedName}|${this.colors.reset}`;
  }

  private passesLogLevelCheck(caller: object): boolean {
    const callerName = caller.constructor.name;

    if (this.logLevel === 'nodb') {
      return callerName !== 'Database';
    } else return true;
  }
}