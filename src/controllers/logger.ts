export default class Logger {
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
    console.log(this.getParentLog(caller), ...args);
  }

  public logErr(...args: any[]) {
    const caller = args.pop();
    console.error(this.getParentLog(caller), ...args);
  }

  private getParentLog(caller: object) {
    let paddedName: string;
    const maxLength = 10; // Maximum length for caller name padding

    switch (caller.constructor.name) {
      case 'App':
        paddedName = 'APP'.padEnd(maxLength);
        return `${this.colors.red}${paddedName}|${this.colors.reset}`;
      case 'Database':
        paddedName = 'DB'.padEnd(maxLength);
        return `${this.colors.yellow}${paddedName}|${this.colors.reset}`;
      case 'Alpaca':
        paddedName = 'ALPACA'.padEnd(maxLength);
        return `${this.colors.cyan}${paddedName}|${this.colors.reset}`;
      case 'Binance':
      case 'Kucoin':
      case 'Btse':
        paddedName = 'BINANCE'.padEnd(maxLength);
        return `${this.colors.magenta}${paddedName}|${this.colors.reset}`;
    }
  }
}