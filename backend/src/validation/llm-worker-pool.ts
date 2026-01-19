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

import { createLogger } from "../utils/logger";

const logger = createLogger("validation/llm-worker-pool");

/**
 * Standardized LLM Error Codes
 */
export enum LLMErrorCode {
  // Network/Infrastructure errors (retryable)
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',        // DeepSeek 500
  SERVER_OVERLOADED = 'SERVER_OVERLOADED', // DeepSeek 503
  RATE_LIMIT = 'RATE_LIMIT',            // DeepSeek 429
  
  // Client errors (non-retryable)
  INVALID_FORMAT = 'INVALID_FORMAT',    // DeepSeek 400
  AUTH_FAILED = 'AUTH_FAILED',          // DeepSeek 401
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE', // DeepSeek 402
  INVALID_PARAMS = 'INVALID_PARAMS',    // DeepSeek 422
  
  // Our internal parsing errors (non-retryable)
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
  NO_CONTENT_ERROR = 'NO_CONTENT_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  
  // Unknown errors (non-retryable by default)
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * LLM Error with standardized code
 */
export class LLMError extends Error {
  constructor(
    public code: LLMErrorCode,
    message: string,
    public originalError?: Error,
    public httpStatus?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }

  get isRetryable(): boolean {
    return [
      LLMErrorCode.NETWORK_ERROR,
      LLMErrorCode.TIMEOUT_ERROR,
      LLMErrorCode.SERVER_ERROR,
      LLMErrorCode.SERVER_OVERLOADED,
      LLMErrorCode.RATE_LIMIT
    ].includes(this.code);
  }
}

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
      maxWorkers: 15, // Reduced default - should be coordinated with pipeline concurrency
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      requestTimeout: 30000, // 30 seconds
      ...config
    };

    logger.info(`LLM Worker Pool initialized with ${this.config.maxWorkers} max workers (GLOBAL LIMIT)`);
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
        retries: 0
      };

      this.queue.push(request);
      this.processQueue();
    });
  }

  /**
   * Process the queue by starting workers if available
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.activeWorkers < this.config.maxWorkers) {
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
      logger.debug(`Worker started for ${request.id} (${this.activeWorkers}/${this.config.maxWorkers} active)`);
      
      const result = await this.executeRequest(request);
      request.resolve(result);
      
    } catch (error) {
      const llmError = this.standardizeError(error);
      
      if (llmError.isRetryable && request.retries < this.config.maxRetries) {
        // Retry the request
        request.retries++;
        logger.warn(`Retrying ${request.id} (attempt ${request.retries}/${this.config.maxRetries}) - ${llmError.code}: ${llmError.message}`);
        
        // Add delay before retry
        setTimeout(() => {
          this.queue.unshift(request); // Add back to front of queue
          this.processQueue();
        }, this.config.retryDelay * request.retries); // Exponential backoff
        
      } else {
        if (!llmError.isRetryable) {
          logger.error(`Request ${request.id} failed with non-retryable error - ${llmError.code}: ${llmError.message}`);
        } else {
          logger.error(`Request ${request.id} failed after ${this.config.maxRetries} retries - ${llmError.code}: ${llmError.message}`);
        }
        request.reject(llmError);
      }
    } finally {
      this.activeWorkers--;
      this.processQueue(); // Process next item in queue
    }
  }

  /**
   * Convert any error to a standardized LLMError
   */
  private standardizeError(error: unknown): LLMError {
    if (error instanceof LLMError) {
      return error;
    }

    if (!(error instanceof Error)) {
      return new LLMError(LLMErrorCode.UNKNOWN_ERROR, String(error));
    }

    const message = error.message;
    const messageLower = message.toLowerCase();

    // Network/timeout errors
    if (error.name === 'AbortError' || messageLower.includes('timeout')) {
      return new LLMError(LLMErrorCode.TIMEOUT_ERROR, message, error);
    }
    if (messageLower.includes('network') || messageLower.includes('connection') || messageLower.includes('econnreset')) {
      return new LLMError(LLMErrorCode.NETWORK_ERROR, message, error);
    }

    // DeepSeek API errors (extract HTTP status from message)
    const httpStatusMatch = message.match(/(\d{3})/);
    const httpStatus = httpStatusMatch ? parseInt(httpStatusMatch[1]) : undefined;

    switch (httpStatus) {
      case 400:
        return new LLMError(LLMErrorCode.INVALID_FORMAT, message, error, 400);
      case 401:
        return new LLMError(LLMErrorCode.AUTH_FAILED, message, error, 401);
      case 402:
        return new LLMError(LLMErrorCode.INSUFFICIENT_BALANCE, message, error, 402);
      case 422:
        return new LLMError(LLMErrorCode.INVALID_PARAMS, message, error, 422);
      case 429:
        return new LLMError(LLMErrorCode.RATE_LIMIT, message, error, 429);
      case 500:
        return new LLMError(LLMErrorCode.SERVER_ERROR, message, error, 500);
      case 503:
        return new LLMError(LLMErrorCode.SERVER_OVERLOADED, message, error, 503);
    }

    // Our internal parsing errors
    if (messageLower.includes('json parse') || messageLower.includes('unexpected token') || messageLower.includes('invalid json')) {
      return new LLMError(LLMErrorCode.JSON_PARSE_ERROR, message, error);
    }
    if (messageLower.includes('no content') || messageLower.includes('no json found')) {
      return new LLMError(LLMErrorCode.NO_CONTENT_ERROR, message, error);
    }

    // Default to unknown error
    return new LLMError(LLMErrorCode.UNKNOWN_ERROR, message, error);
  }


  /**
   * Execute the actual LLM API request
   */
  private async executeRequest(request: LLMRequest): Promise<any> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new LLMError(LLMErrorCode.AUTH_FAILED, "DEEPSEEK_API_KEY environment variable not set");
    }

    const prompt = `You are parsing SEC Exhibit 21 (Subsidiaries of the Registrant) from HTML files. Extract subsidiary information with careful attention to separating company names from jurisdictions.

IMPORTANT PARSING RULES:
1. Company names often contain jurisdictions in parentheses or at the end
2. Common patterns to parse:
   - "Company Name (State)" → name: "Company Name", jurisdiction: "State"
   - "Company Name, Inc. (Delaware)" → name: "Company Name, Inc.", jurisdiction: "Delaware"
   - "Company Name Limited" → name: "Company Name Limited", jurisdiction: extract from context
   - "Cui Yi Information Science and Technology (Shanghai) Company Limited" → name: "Cui Yi Information Science and Technology Company Limited", jurisdiction: "Shanghai"
3. Jurisdictions are typically: US states, countries, or cities (like Shanghai, Hong Kong)
4. Legal suffixes (Inc., LLC, Ltd., Limited, Corp., etc.) are part of the company name
5. If jurisdiction appears within the company name, extract it separately

For each entity, extract:
- name: Clean company name without jurisdiction info in parentheses
- jurisdiction: Geographic location (state, country, or city)
- ownership_percentage: Number if explicitly stated, otherwise null

Return ONLY a JSON object with this structure:
{
  "subsidiaries": [
    {
      "name": "Company Name",
      "jurisdiction": "Delaware",
      "ownership_percentage": 100
    }
  ]
}

HTML content:
${request.html.substring(0, 50000)}`; // Limit HTML to avoid token limits

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Map HTTP status to our error codes
        const status = response.status;
        const statusText = response.statusText;
        const message = `DeepSeek API error: ${status} ${statusText}`;
        
        switch (status) {
          case 400:
            throw new LLMError(LLMErrorCode.INVALID_FORMAT, message, undefined, status);
          case 401:
            throw new LLMError(LLMErrorCode.AUTH_FAILED, message, undefined, status);
          case 402:
            throw new LLMError(LLMErrorCode.INSUFFICIENT_BALANCE, message, undefined, status);
          case 422:
            throw new LLMError(LLMErrorCode.INVALID_PARAMS, message, undefined, status);
          case 429:
            throw new LLMError(LLMErrorCode.RATE_LIMIT, message, undefined, status);
          case 500:
            throw new LLMError(LLMErrorCode.SERVER_ERROR, message, undefined, status);
          case 503:
            throw new LLMError(LLMErrorCode.SERVER_OVERLOADED, message, undefined, status);
          default:
            throw new LLMError(LLMErrorCode.UNKNOWN_ERROR, message, undefined, status);
        }
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new LLMError(LLMErrorCode.NO_CONTENT_ERROR, "No content in DeepSeek API response");
      }

      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new LLMError(LLMErrorCode.NO_CONTENT_ERROR, "No JSON found in LLM response");
      }
      
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        throw new LLMError(
          LLMErrorCode.JSON_PARSE_ERROR, 
          `JSON Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          parseError instanceof Error ? parseError : undefined
        );
      }

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof LLMError) {
        throw error; // Re-throw our standardized errors
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMError(LLMErrorCode.TIMEOUT_ERROR, `Request timeout after ${this.config.requestTimeout}ms`, error);
      }
      
      // Network or other fetch errors
      throw new LLMError(LLMErrorCode.NETWORK_ERROR, error instanceof Error ? error.message : String(error), error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    queueLength: number;
    activeWorkers: number;
    maxWorkers: number;
  } {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      maxWorkers: this.config.maxWorkers
    };
  }

  /**
   * Shutdown the worker pool gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Wait for active workers to complete
    while (this.activeWorkers > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Reject any remaining queued requests
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
 * Get or create the global LLM worker pool instance
 */
export function getLLMWorkerPool(): LLMWorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new LLMWorkerPool();
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