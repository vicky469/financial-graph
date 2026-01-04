import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "node:path";
import type { ILogger, LogMetadata } from "@financial-graph/shared/logger";

// General log directory for entire backend
const LOG_DIR = path.join(process.cwd(), "output", "logs", "backend");

// Common log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Daily rotation transport for error logs
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxSize: "20m",
  maxFiles: "14d", // Keep logs for 14 days
  format: logFormat,
  zippedArchive: true, // Compress rotated files
});

// Daily rotation transport for combined logs
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "combined-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d", // Keep logs for 14 days
  format: logFormat,
  zippedArchive: true, // Compress rotated files
});

// Create the winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports: [
    errorRotateTransport,
    combinedRotateTransport,
    // Also log to console in development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? `\n${JSON.stringify(meta, null, 2)}`
            : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

// Handle transport errors
errorRotateTransport.on("error", (error) => {
  console.error("Error in error log rotation:", error);
});

combinedRotateTransport.on("error", (error) => {
  console.error("Error in combined log rotation:", error);
});

/**
 * Node.js logger implementation using Winston
 * Implements the shared ILogger interface
 */
class NodeLogger implements ILogger {
  private winston: winston.Logger;

  constructor(winstonInstance: winston.Logger) {
    this.winston = winstonInstance;
  }

  debug(message: string, meta?: LogMetadata): void {
    this.winston.debug(message, { ...meta, source: "backend" });
  }

  info(message: string, meta?: LogMetadata): void {
    this.winston.info(message, { ...meta, source: "backend" });
  }

  warn(message: string, meta?: LogMetadata): void {
    this.winston.warn(message, { ...meta, source: "backend" });
  }

  error(message: string, meta?: LogMetadata): void {
    this.winston.error(message, { ...meta, source: "backend" });
  }
}

// Export the unified logger for the entire backend
export const logger: ILogger = new NodeLogger(winstonLogger);
