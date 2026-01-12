/**
 * Shared Logger Interface
 * 
 * Common interface for logging across frontend and backend.
 * Implementations differ (browser vs Node.js) but API is consistent.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogMetadata {
  [key: string]: any;
}

export interface Logger {
  debug(message: string, meta?: LogMetadata): void;
  info(message: string, meta?: LogMetadata): void;
  warn(message: string, meta?: LogMetadata): void;
  error(message: string, meta?: LogMetadata): void;
}

export interface LoggerFactory {
  createLogger(context: string): Logger;
}

/**
 * Failed Record Utilities
 * 
 * Convention for saving failed records during ingestion/processing.
 * Failed records are separate from logs and stored in a structured format.
 */

export interface FailedRecord<T = any> {
  timestamp: string;
  context: string;
  identifier: string | number;
  data: T;
  error: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface FailedRecordOptions {
  /** Base directory for failed records (e.g., 'financial-graph/backend/logs/failed-records') */
  baseDir: string;
  /** Context/module name (e.g., 'ticker-ingestion', 'subsidiary-parser') */
  context: string;
  /** Optional date for organizing by date (defaults to today) */
  date?: Date;
}

/**
 * Generate a standardized path for failed records
 * 
 * Convention: {baseDir}/{context}/{YYYY-MM-DD}/failed-{context}-{timestamp}.json
 * 
 * Example: logs/failed-records/ticker-ingestion/2026-01-12/failed-ticker-ingestion-20260112-143022.json
 */
export function getFailedRecordPath(options: FailedRecordOptions): string {
  const date = options.date || new Date();
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const timestamp = date.toISOString().replace(/[:.]/g, "-").split("T").join("-").slice(0, -5); // YYYY-MM-DD-HHmmss
  
  return `${options.baseDir}/${options.context}/${dateStr}/failed-${options.context}-${timestamp}.json`;
}

/**
 * Create a failed record object
 */
export function createFailedRecord<T>(
  context: string,
  identifier: string | number,
  data: T,
  error: Error | string
): FailedRecord<T> {
  const errorObj = typeof error === "string" 
    ? { message: error }
    : {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };

  return {
    timestamp: new Date().toISOString(),
    context,
    identifier,
    data,
    error: errorObj,
  };
}
