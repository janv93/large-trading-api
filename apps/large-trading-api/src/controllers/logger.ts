import { LogLevel } from '@shared';

export default class Logger {
  private logLevel: LogLevel = LogLevel.Default;
  private progressActive = false;
  private lastLoggedPercent = -1;
  // saving original console log is necessary to prevent recursive overrides
  private originalConsoleLog = console.log;
  private originalConsoleError = console.error;

  constructor() {
    console.log = (...args: any[]) => {
      this.clearProgress();
      this.originalConsoleLog(...args);
    };

    console.error = (...args: any[]) => {
      this.clearProgress();
      this.originalConsoleError(...args);
    };
  }

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

  public log(...args: any[]): void {
    const caller = args.pop();

    if (this.passesLogLevelCheck(caller)) {
      console.log(this.getParentLog(caller), ...args);
    }
  }

  public logErr(...args: any[]): void {
    const caller = args.pop();

    if (this.passesLogLevelCheck(caller)) {
      console.error(`${this.getParentLog(caller)} ${this.colors.red}ERR${this.colors.reset}`, ...args);
    }
  }

  public logProgress(percent: number, caller: string): void {
    if (this.passesLogLevelCheck(caller)) {
      // progress bar with 20 segments, each segment represents 5%
      const filled: number = Math.min(20, Math.floor(percent / 5));
      const bar: string = '█'.repeat(filled) + '░'.repeat(20 - filled);
      const rounded: number = Math.round(percent);

      if (percent >= 100) {
        process.stdout.write(`\x1b[2K\r\x1b[?25h`);
        this.progressActive = false;
        this.lastLoggedPercent = -1;
      } else if (rounded !== this.lastLoggedPercent) {
        this.progressActive = true;
        this.lastLoggedPercent = rounded;
        process.stdout.write(`\x1b[?25l\x1b[2K\r${this.getParentLog(caller)} ${bar} ${rounded}%`);
      }
    }
  }

  private getParentLog(caller: string): string {
    const maxLength = 15;
    let color: string;

    switch (caller) {
      case 'App': color = this.colors.blue; break;
      case 'Routes': color = this.colors.magenta; break;
      case 'Database': color = this.colors.green; break;
      case 'Alpaca': color = this.colors.orange; break;
      case 'Backtester': color = this.colors.cyan; break;
      // crypto
      case 'Binance':
      case 'Kucoin':
      case 'Btse':
      case 'Coinmarketcap': color = this.colors.yellow; break;
      default: color = this.colors.white; break;
    }

    const paddedName = caller.toUpperCase().slice(0, maxLength - 2).padEnd(maxLength);
    return `${color}${paddedName}|${this.colors.reset}`;
  }

  private clearProgress(): void {
    if (this.progressActive) {
      process.stdout.write('\x1b[2K\r\x1b[?25h');
      this.progressActive = false;
    }
  }

  private passesLogLevelCheck(caller: string): boolean {
    if (this.logLevel === LogLevel.NoDb) {
      return caller !== 'Database';
    } else return true;
  }
}