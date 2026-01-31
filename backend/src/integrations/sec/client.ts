/**
 * SEC API Client
 * 
 * Centralized client for interacting with SEC EDGAR API
 * Handles rate limiting, retries, and common headers
 */

import { SEC_USER_AGENT, SEC_REQUEST_DELAY_MS, SEC_REQUEST_MAX_RETRIES } from '../../data_source/sec/config';

/**
 * Standard SEC API headers
 * Required by SEC.gov for all API requests
 */
export const SEC_HEADERS = {
  'User-Agent': SEC_USER_AGENT,
  'Accept-Encoding': 'gzip, deflate',
  'Host': 'www.sec.gov',
} as const;

/**
 * SEC API Client Configuration
 */
export interface SECClientConfig {
  /** Custom user agent (defaults to SEC_USER_AGENT from env) */
  userAgent?: string;
  /** Delay between requests in milliseconds (defaults to SEC_REQUEST_DELAY_MS) */
  requestDelayMs?: number;
  /** Maximum number of retries for failed requests (defaults to SEC_REQUEST_MAX_RETRIES) */
  maxRetries?: number;
  /** Additional headers to include in requests */
  additionalHeaders?: Record<string, string>;
}

/**
 * SEC API Client
 * 
 * Provides a centralized way to make requests to SEC EDGAR API
 * with proper rate limiting, retries, and error handling
 */
export class SECClient {
  private userAgent: string;
  private requestDelayMs: number;
  private maxRetries: number;
  private additionalHeaders: Record<string, string>;
  private lastRequestTime: number = 0;

  constructor(config: SECClientConfig = {}) {
    this.userAgent = config.userAgent || SEC_USER_AGENT;
    this.requestDelayMs = config.requestDelayMs ?? SEC_REQUEST_DELAY_MS;
    this.maxRetries = config.maxRetries ?? SEC_REQUEST_MAX_RETRIES;
    this.additionalHeaders = config.additionalHeaders || {};
  }

  /**
   * Get standard SEC headers with optional overrides
   */
  getHeaders(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      'User-Agent': this.userAgent,
      'Accept-Encoding': 'gzip, deflate',
      'Host': 'www.sec.gov',
      ...this.additionalHeaders,
      ...overrides,
    };
  }

  /**
   * Wait for rate limit delay
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelayMs) {
      const waitTime = this.requestDelayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Make a GET request to SEC API with rate limiting and retries
   */
  async get(url: string, options: RequestInit = {}): Promise<Response> {
    await this.waitForRateLimit();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          method: 'GET',
          headers: {
            ...this.getHeaders(),
            ...(options.headers || {}),
          },
        });

        // Handle rate limiting (429)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.requestDelayMs * 2;
          
          console.warn(`Rate limited by SEC API. Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Return response for caller to handle
        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`SEC API request failed (attempt ${attempt + 1}/${this.maxRetries}):`, error);
        
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.requestDelayMs));
        }
      }
    }

    throw new Error(`SEC API request failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Fetch and parse JSON from SEC API
   */
  async getJSON<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await this.get(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch text content from SEC API
   */
  async getText(url: string, options: RequestInit = {}): Promise<string> {
    const response = await this.get(url, {
      ...options,
      headers: {
        'Accept': 'text/plain',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Fetch HTML content from SEC API
   */
  async getHTML(url: string, options: RequestInit = {}): Promise<string> {
    const response = await this.get(url, {
      ...options,
      headers: {
        'Accept': 'text/html',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`SEC API returned ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }
}

/**
 * Default SEC client instance
 * Use this for most SEC API requests
 */
export const secClient = new SECClient();

/**
 * Create a custom SEC client with specific configuration
 */
export function createSECClient(config: SECClientConfig): SECClient {
  return new SECClient(config);
}
