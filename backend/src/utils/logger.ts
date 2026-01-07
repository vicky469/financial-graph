import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

const LOG_DIR = "logs";

// Custom format for console (readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// File format options
const humanReadableFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Choose file format: 'human' or 'json'
const FILE_FORMAT_TYPE = process.env.LOG_FORMAT || "human";
const fileFormat = FILE_FORMAT_TYPE === "json" ? jsonFormat : humanReadableFormat;

// Rotational File Transport
const transport = new winston.transports.DailyRotateFile({
  filename: "%DATE%/audit.log", // Creates logs/2026-01-05/audit.log
  dirname: LOG_DIR,
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "3d", // Retention: 3 days
  createSymlink: true,
  symlinkName: "latest.log",
  format: fileFormat, // Adds timestamp to each log entry
});

// Logger Instance (Internal)
const baseLogger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    transport,
  ],
});

// Context-aware Logger Factory
export const createLogger = (context: string) => {
  const commonMeta = { module: context };

  return {
    info: (msg: string, meta: Record<string, any> = {}) => {
      baseLogger.info(msg, { ...commonMeta, ...meta });
    },
    warn: (msg: string, meta: Record<string, any> = {}) => {
      baseLogger.warn(msg, { ...commonMeta, ...meta });
    },
    error: (msg: string, meta: Record<string, any> = {}) => {
      baseLogger.error(msg, { ...commonMeta, ...meta });
    },
  };
};

// Deprecated: Use createLogger instead
export const logger = createLogger("Global");
