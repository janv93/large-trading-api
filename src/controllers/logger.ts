import { createLogger, format, transports } from 'winston';
const { combine, timestamp, label, printf } = format;

// Custom logging format that includes the level, message, and timestamp.
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

export class Logger {
  private logger;

  constructor(caller: string) {
    this.logger = createLogger({
      // Apply custom formatting to all logs.
      format: combine(
        label({ label: caller }),
        timestamp(),
        logFormat
      ),
      transports: [
        new transports.Console(), // Log to console.
        // Add other transports here if needed (e.g., file transport).
      ],
    });
  }

  public info(message: string): void {
    this.logger.info(message);
  }

  public warn(message: string): void {
    this.logger.warn(message);
  }

  public error(message: string): void {
    this.logger.error(message);
  }

  public debug(message: string): void {
    this.logger.debug(message);
  }
}
