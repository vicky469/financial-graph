/**
 * Shared logging types and interfaces for both frontend and backend
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogMetadata {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
  source?: "frontend" | "backend";
  userId?: string;
  sessionId?: string;
}

/**
 * Common logger interface that works in both browser and Node.js
 */
export interface ILogger {
  debug(message: string, meta?: LogMetadata): void;
  info(message: string, meta?: LogMetadata): void;
  warn(message: string, meta?: LogMetadata): void;
  error(message: string, meta?: LogMetadata): void;
}

/**
 * Configuration for logger behavior
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile?: boolean; // Node.js only
  enableRemote?: boolean; // Send logs to backend
  remoteEndpoint?: string;
  maxBatchSize?: number; // For batched remote logging
  flushInterval?: number; // How often to flush logs (ms)
}

/**
 * Log levels with numeric priority
 */
export const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be logged based on configured level
 */
export function shouldLog(
  messageLevel: LogLevel,
  configuredLevel: LogLevel
): boolean {
  return LOG_LEVELS[messageLevel] >= LOG_LEVELS[configuredLevel];
}
