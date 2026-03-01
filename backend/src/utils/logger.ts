import winston from "winston";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger, LogMetadata } from "@financial-graph/shared";

// Use absolute path to ensure logs go to backend/logs
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const LOG_ROOT_DIR = path.resolve(MODULE_DIR, "../../logs");
const LATEST_LOG_PATH = path.join(LOG_ROOT_DIR, "latest.log");

function toLocalDateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveRunLogBaseName(): string {
  const envName = process.env.LOG_FILE_NAME?.trim();
  if (envName) {
    return sanitizeFileName(envName);
  }

  const entry = process.argv[1];
  if (!entry) return "app";

  const parsed = path.parse(entry);
  const base = parsed.name.trim();
  return base.length > 0 ? sanitizeFileName(base) : "app";
}

const DATE_STAMP = toLocalDateStamp(new Date());
const RUN_LOG_BASENAME = resolveRunLogBaseName();
const LOG_DATE_DIR = path.join(LOG_ROOT_DIR, DATE_STAMP);
const RUN_LOG_PATH = path.join(LOG_DATE_DIR, `${RUN_LOG_BASENAME}.log`);

// Ensure logs directory exists
if (!fs.existsSync(LOG_ROOT_DIR)) {
  fs.mkdirSync(LOG_ROOT_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_DATE_DIR)) {
  fs.mkdirSync(LOG_DATE_DIR, { recursive: true });
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

// Job/run scoped transport: logs/YYYY-MM-DD/{entrypoint}.log
const runFileTransport = new winston.transports.File({
  filename: RUN_LOG_PATH,
  format: fileFormat,
});

// Clean up old log folders/files on startup
function cleanupOldLogs() {
  try {
    const files = fs.readdirSync(LOG_ROOT_DIR);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      // Clean up legacy flat log layout artifacts from previous configuration.
      if (file === ".winston-audit.json" || file.startsWith("audit.log.")) {
        const legacyPath = path.join(LOG_ROOT_DIR, file);
        try {
          const legacyStats = fs.statSync(legacyPath);
          if (legacyStats.isFile()) {
            fs.unlinkSync(legacyPath);
            console.log(`   - Cleaned up legacy log file: ${file}`);
          }
        } catch {}
        continue;
      }

      // Skip current files and directories
      if (file === "latest.log" || 
          file === "README.md" ||
          file === "failed-records") {
        continue;
      }
      
      const filePath = path.join(LOG_ROOT_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(file)) {
          continue;
        }

        const folderDate = new Date(`${file}T00:00:00`);
        if (Number.isNaN(folderDate.getTime())) {
          continue;
        }

        if (folderDate < new Date(toLocalDateStamp(sevenDaysAgo) + "T00:00:00")) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`   - Cleaned up old log folder: ${file}`);
        }
        continue;
      }

      // Clean up old flat log files from previous logger layouts
      if (stats.isFile() && stats.mtime < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`   - Cleaned up old log file: ${file}`);
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
    runFileTransport,
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

// Verify log directory and retention settings
console.log(`📝 Logger initialized:`);
console.log(`   - Log root: ${LOG_ROOT_DIR}`);
console.log(`   - Date folder: ${LOG_DATE_DIR}`);
console.log(`   - Run log file: ${RUN_LOG_PATH}`);
console.log(`   - Retention: 7 days`);
console.log(`   - Latest log: ${LATEST_LOG_PATH}`);
