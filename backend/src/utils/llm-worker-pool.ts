/**
 * LLM Worker Pool for Parallel Processing
 *
 * Manages a pool of workers to handle LLM API calls concurrently,
 * significantly improving pipeline performance when many filings
 * require LLM fallback processing.
 *
 * IMPORTANT: This is a GLOBAL singleton to coordinate LLM requests
 * across all pipeline workers and prevent API rate limit issues.
 */

import { createLogger } from "./logger";
import {
  callDeepSeekForSubsidiaries,
  DeepSeekError,
  DeepSeekErrorCode,
} from "../integration/deepseek";

const logger = createLogger("utils/llm-worker-pool");

interface LLMRequest {
  id: string;
  html: string;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  retries: number;
}

interface LLMWorkerPoolConfig {
  maxWorkers: number;
  maxRetries: number;
  retryDelay: number;
  requestTimeout: number;
}

/**
 * LLM Worker Pool for handling concurrent API requests
 */
export class LLMWorkerPool {
  private config: LLMWorkerPoolConfig;
  private queue: LLMRequest[] = [];
  private activeWorkers = 0;
  private isShuttingDown = false;

  constructor(config: Partial<LLMWorkerPoolConfig> = {}) {
    this.config = {
      maxWorkers: 15,
      maxRetries: 3,
      retryDelay: 1000,
      requestTimeout: 30000,
      ...config,
    };

    logger.info(
      `LLM Worker Pool initialized with ${this.config.maxWorkers} max workers (GLOBAL LIMIT)`,
    );
  }

  /**
   * Add a request to the queue and return a promise
   */
  async processRequest(id: string, html: string): Promise<any> {
    if (this.isShuttingDown) {
      throw new Error("Worker pool is shutting down");
    }

    return new Promise((resolve, reject) => {
      const request: LLMRequest = {
        id,
        html,
        resolve,
        reject,
        retries: 0,
      };

      this.queue.push(request);
      this.processQueue();
    });
  }

  /**
   * Process the queue by starting workers if available
   */
  private processQueue(): void {
    while (
      this.queue.length > 0 &&
      this.activeWorkers < this.config.maxWorkers
    ) {
      const request = this.queue.shift();
      if (request) {
        this.startWorker(request);
      }
    }
  }

  /**
   * Start a worker to process a request
   */
  private async startWorker(request: LLMRequest): Promise<void> {
    this.activeWorkers++;

    try {
      logger.debug(
        `Worker started for ${request.id} (${this.activeWorkers}/${this.config.maxWorkers} active)`,
      );

      const result = await this.executeRequest(request);
      request.resolve(result);
    } catch (error) {
      const llmError =
        error instanceof DeepSeekError
          ? error
          : new DeepSeekError(
              DeepSeekErrorCode.UNKNOWN_ERROR,
              error instanceof Error ? error.message : String(error),
              error instanceof Error ? error : undefined,
            );

      if (llmError.isRetryable && request.retries < this.config.maxRetries) {
        request.retries++;
        logger.warn(
          `Retrying ${request.id} (attempt ${request.retries}/${this.config.maxRetries}) - ${llmError.code}: ${llmError.message}`,
        );

        setTimeout(() => {
          this.queue.unshift(request);
          this.processQueue();
        }, this.config.retryDelay * request.retries);
      } else {
        if (!llmError.isRetryable) {
          logger.error(
            `Request ${request.id} failed with non-retryable error - ${llmError.code}: ${llmError.message}`,
          );
        } else {
          logger.error(
            `Request ${request.id} failed after ${this.config.maxRetries} retries - ${llmError.code}: ${llmError.message}`,
          );
        }
        request.reject(llmError);
      }
    } finally {
      this.activeWorkers--;
      this.processQueue();
    }
  }

  /**
   * Execute the actual LLM API request
   */
  private async executeRequest(request: LLMRequest): Promise<any> {
    return callDeepSeekForSubsidiaries(request.html, {
      requestTimeout: this.config.requestTimeout,
    });
  }

  /**
   * Shutdown the worker pool gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    while (this.activeWorkers > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        request.reject(new Error("Worker pool shutdown"));
      }
    }

    logger.info("LLM Worker Pool shutdown complete");
  }
}

// Global singleton instance
let globalWorkerPool: LLMWorkerPool | null = null;

/**
 * Get or create the global LLM worker pool instance.
 * If a config is provided after initialization, it will be ignored.
 */
export function getLLMWorkerPool(
  config: Partial<LLMWorkerPoolConfig> = {},
): LLMWorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new LLMWorkerPool(config);
    return globalWorkerPool;
  }

  if (Object.keys(config).length > 0) {
    logger.warn(
      "LLM Worker Pool already initialized; ignoring custom config",
    );
  }

  return globalWorkerPool;
}

/**
 * Shutdown the global worker pool (useful for cleanup)
 */
export async function shutdownLLMWorkerPool(): Promise<void> {
  if (globalWorkerPool) {
    await globalWorkerPool.shutdown();
    globalWorkerPool = null;
  }
}
