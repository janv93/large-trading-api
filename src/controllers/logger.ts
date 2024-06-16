import { LogLevel } from '../interfaces';

export default class Logger {
  private logLevel: LogLevel = LogLevel.NoDb;

  private colors = {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    orange: '\x1b[38;5;208m',
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

  private getParentLog(caller: string) {
    const maxLength = 15;
    let color: string;

    switch (caller) {
      case 'App': color = this.colors.blue; break;
      case 'Routes': color = this.colors.magenta; break;
      case 'Database': color = this.colors.green; break;
      case 'Alpaca': color = this.colors.orange; break;
      case 'Binance': // crypto
      case 'Kucoin':
      case 'Btse':
      case 'Coinmarketcap': color = this.colors.yellow; break;
      default: color = this.colors.reset; break;
    }

    const paddedName = caller.toUpperCase().padEnd(maxLength);
    return `${color}${paddedName}|${this.colors.reset}`;
  }

  private passesLogLevelCheck(caller: string): boolean {
    if (this.logLevel === LogLevel.NoDb) {
      return caller !== 'Database';
    } else return true;
  }
}