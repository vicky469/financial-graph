import { BrowserLogger } from "./BrowserLogger";

/**
 * Configured logger instance for the frontend application
 */
export const logger = new BrowserLogger({
  level: import.meta.env.VITE_LOG_LEVEL || "info",
  enableConsole: true,
  enableRemote: import.meta.env.VITE_ENABLE_REMOTE_LOGGING === "true",
  remoteEndpoint: import.meta.env.VITE_LOG_ENDPOINT || "http://localhost:3000/api/logs",
  maxBatchSize: 50,
  flushInterval: 10000, // 10 seconds
});

// Export for debugging purposes
if (import.meta.env.DEV) {
  (window as any).__logger = logger;
}
