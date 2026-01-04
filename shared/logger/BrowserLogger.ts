import type {
  ILogger,
  LogEntry,
  LoggerConfig,
  LogLevel,
  LogMetadata,
} from "./types";
import { shouldLog } from "./types";

/**
 * Browser-compatible logger with console output and optional remote logging
 */
export class BrowserLogger implements ILogger {
  private config: LoggerConfig;
  private logQueue: LogEntry[] = [];
  private flushTimer: number | undefined;
  private readonly sessionId: string;

  public constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || "info",
      enableConsole: config.enableConsole ?? true,
      enableRemote: config.enableRemote ?? false,
      remoteEndpoint: config.remoteEndpoint || "/api/logs",
      maxBatchSize: config.maxBatchSize || 50,
      flushInterval: config.flushInterval || 10000, // 10 seconds
    };

    // Generate session ID
    this.sessionId = this.generateSessionId();

    // Set up periodic flush if remote logging is enabled
    if (this.config.enableRemote) {
      this.startFlushTimer();
      this.setupBeforeUnloadHandler();
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private startFlushTimer(): void {
    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private setupBeforeUnloadHandler(): void {
    window.addEventListener("beforeunload", () => {
      this.flush(true);
    });
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    meta?: LogMetadata
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source: "frontend",
      sessionId: this.sessionId,
    };

    if (meta) {
      entry.metadata = meta;
    }

    return entry;
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const style: string = this.getConsoleStyle(entry.level);
    const timestamp: string = new Date(entry.timestamp).toLocaleTimeString();

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console[entry.level === "debug" ? "log" : entry.level](
        `%c[${timestamp}] ${entry.level.toUpperCase()}:%c ${entry.message}`,
        style,
        "",
        entry.metadata
      );
    } else {
      console[entry.level === "debug" ? "log" : entry.level](
        `%c[${timestamp}] ${entry.level.toUpperCase()}:%c ${entry.message}`,
        style,
        ""
      );
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    const styles: Record<LogLevel, string> = {
      debug: "color: #888; font-weight: normal",
      info: "color: #2196F3; font-weight: bold",
      warn: "color: #FF9800; font-weight: bold",
      error: "color: #F44336; font-weight: bold",
    };
    return styles[level];
  }

  private queueForRemote(entry: LogEntry): void {
    if (!this.config.enableRemote) return;

    this.logQueue.push(entry);

    // Auto-flush if queue is full
    if (this.logQueue.length >= (this.config.maxBatchSize || 50)) {
      this.flush();
    }
  }

  /**
   * Flush queued logs to remote endpoint
   * @param sync - Use synchronous request (for beforeunload)
   */
  private flush(sync: boolean = false): void {
    if (!this.config.enableRemote || this.logQueue.length === 0) return;

    const logsToSend: LogEntry[] = [...this.logQueue];
    this.logQueue = [];

    const payload: string = JSON.stringify({ logs: logsToSend });

    if (sync && navigator.sendBeacon) {
      // Use sendBeacon for synchronous unload events
      navigator.sendBeacon(this.config.remoteEndpoint!, payload);
    } else {
      // Use fetch for async logging
      fetch(this.config.remoteEndpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch((err: unknown) => {
        // Silently fail remote logging to avoid infinite loops
        console.error("Failed to send logs to remote:", err);
      });
    }
  }

  private log(level: LogLevel, message: string, meta?: LogMetadata): void {
    if (!shouldLog(level, this.config.level)) return;

    const entry = this.createLogEntry(level, message, meta);
    this.logToConsole(entry);
    this.queueForRemote(entry);
  }

  public debug(message: string, meta?: LogMetadata): void {
    this.log("debug", message, meta);
  }

  public info(message: string, meta?: LogMetadata): void {
    this.log("info", message, meta);
  }

  public warn(message: string, meta?: LogMetadata): void {
    this.log("warn", message, meta);
  }

  public error(message: string, meta?: LogMetadata): void {
    this.log("error", message, meta);
  }

  /**
   * Update logger configuration at runtime
   */
  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart flush timer if remote logging settings changed
    if (config.enableRemote !== undefined || config.flushInterval) {
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      if (this.config.enableRemote) {
        this.startFlushTimer();
      }
    }
  }

  /**
   * Manually flush logs
   */
  public flushNow(): void {
    this.flush();
  }

  /**
   * Destroy logger and clean up resources
   */
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(true);
  }
}
