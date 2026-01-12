/**
 * Simple browser logger with console output and optional remote logging
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  level?: LogLevel;
  enableConsole?: boolean;
  enableRemote?: boolean;
  remoteEndpoint?: string;
  maxBatchSize?: number;
  flushInterval?: number;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class BrowserLogger {
  private config: Required<LoggerConfig>;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: number;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level || "info",
      enableConsole: config.enableConsole ?? true,
      enableRemote: config.enableRemote ?? false,
      remoteEndpoint: config.remoteEndpoint || "",
      maxBatchSize: config.maxBatchSize || 50,
      flushInterval: config.flushInterval || 10000,
    };

    if (this.config.enableRemote) {
      this.startFlushTimer();
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    // Console output
    if (this.config.enableConsole) {
      const consoleMethod = level === "debug" ? "log" : level;
      if (data) {
        console[consoleMethod](`[${level.toUpperCase()}]`, message, data);
      } else {
        console[consoleMethod](`[${level.toUpperCase()}]`, message);
      }
    }

    // Buffer for remote logging
    if (this.config.enableRemote) {
      this.logBuffer.push(entry);
      if (this.logBuffer.length >= this.config.maxBatchSize) {
        this.flush();
      }
    }
  }

  debug(message: string, data?: any) {
    this.log("debug", message, data);
  }

  info(message: string, data?: any) {
    this.log("info", message, data);
  }

  warn(message: string, data?: any) {
    this.log("warn", message, data);
  }

  error(message: string, data?: any) {
    this.log("error", message, data);
  }

  private startFlushTimer() {
    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private async flush() {
    if (this.logBuffer.length === 0) return;

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    if (this.config.remoteEndpoint) {
      try {
        await fetch(this.config.remoteEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logs }),
        });
      } catch (err) {
        console.error("Failed to send logs to remote endpoint:", err);
      }
    }
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}
