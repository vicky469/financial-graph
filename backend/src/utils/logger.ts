import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger, LogMetadata } from "@financial-graph/shared";

// Use absolute path to ensure logs go to backend/logs
const LOG_DIR = path.resolve(__dirname, "../../logs");
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
const formatLog = (
  timestamp: string,
  level: string,
  message: string,
  meta: Record<string, any>,
) => {
  const correlationId =
    typeof meta.correlationId === "string" && meta.correlationId.trim().length > 0
      ? meta.correlationId
      : null;

  const messageText = String(message);
  const messageWithCorrelation =
    correlationId && !messageText.includes(`[${correlationId}]`)
      ? `[${correlationId}] ${messageText}`
      : messageText;

  const { correlationId: _correlationId, ...metaWithoutCorrelation } = meta;
  const lower = level.toLowerCase();
  const metaForLevel =
    lower.includes("warn") || lower.includes("error")
      ? metaWithoutCorrelation
      : (() => {
          const { module, ...rest } = metaWithoutCorrelation;
          return rest;
        })();

  const metaStr =
    Object.keys(metaForLevel).length > 0 ? ` ${JSON.stringify(metaForLevel)}` : "";
  return `${timestamp} [${level}]: ${messageWithCorrelation}${metaStr}`;
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
  filename: "audit.log.%DATE%", // Creates logs/audit.log.2026-01-12
  dirname: LOG_DIR,
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "7d", // Retention: 7 days (automatically deletes older files)
  format: fileFormat,
  auditFile: path.join(LOG_DIR, ".winston-audit.json"), // Track rotation metadata
});

// Clean up old/orphaned log files on startup
function cleanupOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      // Skip current files and directories
      if (file === "latest.log" || 
          file === ".winston-audit.json" || 
          file === "README.md" ||
          file === "failed-records") {
        continue;
      }
      
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);
      
      // Delete old log files
      if (stats.isFile() && stats.mtime < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`   - Cleaned up old log: ${file}`);
      }
      
      // Clean up old audit.json files from previous configurations
      if (file.endsWith("-audit.json") && file !== ".winston-audit.json") {
        fs.unlinkSync(filePath);
        console.log(`   - Cleaned up old audit file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Error cleaning up old logs:", error);
  }
}

// Run cleanup on startup
cleanupOldLogs();

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

const logMetadataStore = new AsyncLocalStorage<LogMetadata>();

function getActiveLogMetadata(): LogMetadata {
  return logMetadataStore.getStore() ?? {};
}

export function withLogMetadata<T>(
  metadata: LogMetadata,
  fn: () => T,
): T {
  const current = getActiveLogMetadata();
  const mergedMetadata = { ...current, ...metadata };
  return logMetadataStore.run(mergedMetadata, fn);
}

// Context-aware Logger Factory
export const createLogger = (context: string): Logger => {
  const commonMeta = { module: context };

  return {
    debug: (msg: string, meta: LogMetadata = {}) => {
      baseLogger.debug(msg, { ...getActiveLogMetadata(), ...commonMeta, ...meta });
    },
    info: (msg: string, meta: LogMetadata = {}) => {
      baseLogger.info(msg, { ...getActiveLogMetadata(), ...commonMeta, ...meta });
    },
    warn: (msg: string, meta: LogMetadata = {}) => {
      baseLogger.warn(msg, { ...getActiveLogMetadata(), ...commonMeta, ...meta });
    },
    error: (msg: string, meta: LogMetadata = {}) => {
      baseLogger.error(msg, { ...getActiveLogMetadata(), ...commonMeta, ...meta });
    },
  };
};

// Deprecated: Use createLogger instead
export const logger = createLogger("Global");

// Log retention verification on startup
dailyTransport.on("rotate", (oldFilename, newFilename) => {
  console.log(`Log rotated: ${oldFilename} -> ${newFilename}`);
});

// Verify log directory and retention settings
console.log(`📝 Logger initialized:`);
console.log(`   - Log directory: ${LOG_DIR}`);
console.log(`   - Retention: 7 days`);
console.log(`   - Latest log: ${LATEST_LOG_PATH}`);
