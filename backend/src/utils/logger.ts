import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

const LOG_DIR = "logs";
const LATEST_LOG_PATH = path.join(LOG_DIR, "latest.log");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Clear latest.log on startup (only contains last run)
// Remove symlink if it exists and create a regular file
try {
  const stats = fs.lstatSync(LATEST_LOG_PATH);
  if (stats.isSymbolicLink()) {
    fs.unlinkSync(LATEST_LOG_PATH);
  }
  fs.writeFileSync(LATEST_LOG_PATH, "");
} catch (e: any) {
  if (e.code !== "ENOENT") {
    // Ignore "file not found" errors, but try to create the file
  }
  try {
    fs.writeFileSync(LATEST_LOG_PATH, "");
  } catch {}
}

// Base format function (shared logic)
const formatLog = (timestamp: string, level: string, message: string, meta: Record<string, any>) => {
  const lowerLevel = level.toLowerCase();
  const isWarnOrError = lowerLevel.includes("warn") || lowerLevel.includes("error");
  const metaStr = isWarnOrError && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]: ${message}${metaStr}`;
};

// Custom format for console (readable, with colors)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => 
    formatLog(timestamp as string, level as string, message as string, meta))
);

// File format
const humanReadableFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => 
    formatLog(timestamp as string, (level as string), message as string, meta))
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Choose file format: 'human' or 'json'
const FILE_FORMAT_TYPE = process.env.LOG_FORMAT || "human";
const fileFormat = FILE_FORMAT_TYPE === "json" ? jsonFormat : humanReadableFormat;

// Daily rotating file transport (keeps logs by day)
const dailyTransport = new winston.transports.DailyRotateFile({
  filename: "%DATE%/audit.log", // Creates logs/2026-01-05/audit.log
  dirname: LOG_DIR,
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "3d", // Retention: 3 days
  format: fileFormat,
});

// Latest.log transport (overwritten each run)
const latestTransport = new winston.transports.File({
  filename: LATEST_LOG_PATH,
  format: fileFormat,
});

// Logger Instance (Internal)
const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info", // Allow configurable log level
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    dailyTransport,
    latestTransport,
  ],
});

// Context-aware Logger Factory
export const createLogger = (context: string) => {
  const commonMeta = { module: context };

  return {
    debug: (msg: string, meta: Record<string, any> = {}) => {
      baseLogger.debug(msg, { ...commonMeta, ...meta });
    },
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
