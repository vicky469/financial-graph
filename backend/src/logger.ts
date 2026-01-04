import winston from "winston";
import type { ILogger, LogMetadata } from "@financial-graph/shared/logger";

const winstonLogger: winston.Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Simple logger implementing shared ILogger interface
 */
class Logger implements ILogger {
  public debug(message: string, meta?: LogMetadata): void {
    winstonLogger.debug(message, meta);
  }

  public info(message: string, meta?: LogMetadata): void {
    winstonLogger.info(message, meta);
  }

  public warn(message: string, meta?: LogMetadata): void {
    winstonLogger.warn(message, meta);
  }

  public error(message: string, meta?: LogMetadata): void {
    winstonLogger.error(message, meta);
  }
}

export const logger: ILogger = new Logger();
