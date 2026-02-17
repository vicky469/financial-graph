/**
 * LLM Worker Pool for Parallel Processing
 *
 * Executes provider tasks through the provider registry contract.
 * This keeps the pool decoupled from concrete provider integrations.
 */

import { createLogger, withLogMetadata } from "./logger";
import {
  createDefaultProviderRegistry,
  ProviderRegistry,
} from "../integration/provider/provider-registry";
import {
  LLMProvider,
  LLMProviderInput,
  ProviderName,
  ProviderRequestType,
} from "../integration/provider/types";
import { DeepSeekError, DeepSeekErrorCode } from "../integration/deepseek";
import { QwenError, QwenErrorCode } from "../integration/qwen";
import {
  DEFAULT_LLM_HARD_REQUEST_TIMEOUT_MS,
  DEFAULT_LLM_HARD_TIMEOUT_BUFFER_MS,
  DEFAULT_LLM_POOL_MAX_WORKERS,
  DEFAULT_LLM_REQUEST_TIMEOUT_MS,
} from "../integration/llm-constants";
import { computeRetryDelayMs, withTimeout } from "./async-control";

const logger = createLogger("utils/llm-worker-pool");

type LLMProviderError = DeepSeekError | QwenError;

type TextTaskPayload = {
  html: string;
};

type VisionTaskPayload = {
  imageUrls: string[];
};

type PdfTaskPayload = {
  pdfDataUrl: string;
};

type LLMProviderTaskPayload =
  | TextTaskPayload
  | VisionTaskPayload
  | PdfTaskPayload;

export type LLMProviderTask = {
  requestId: string;
  providerKey: ProviderName;
  requestType: ProviderRequestType;
  payload: LLMProviderTaskPayload;
};

interface LLMRequest {
  task: LLMProviderTask;
  provider: LLMProvider;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  retries: number;
}

interface LLMWorkerPoolConfig {
  maxWorkers: number;
  providerMaxWorkers: Record<ProviderName, number>;
  hardRequestTimeout: number;
}

function normalizeProviderMaxWorkers(
  maxWorkers: number,
  overrides?: Partial<Record<ProviderName, number>>,
): Record<ProviderName, number> {
  const defaults: Record<ProviderName, number> = {
    deepseek: maxWorkers,
    "qwen-vl": Math.max(1, Math.min(4, maxWorkers)),
    gpt: Math.max(1, Math.min(4, maxWorkers)),
  };

  if (!overrides) {
    return defaults;
  }

  const resolveOverride = (
    value: number | undefined,
    fallback: number,
  ): number => {
    if (typeof value !== "number") return fallback;
    const normalized = Math.floor(value);
    return Number.isFinite(normalized) && normalized > 0
      ? normalized
      : fallback;
  };

  return {
    deepseek: resolveOverride(overrides.deepseek, defaults.deepseek),
    "qwen-vl": resolveOverride(overrides["qwen-vl"], defaults["qwen-vl"]),
    gpt: resolveOverride(overrides.gpt, defaults.gpt),
  };
}

function resolveConfig(
  config: Partial<LLMWorkerPoolConfig>,
): LLMWorkerPoolConfig {
  const maxWorkers = config.maxWorkers || DEFAULT_LLM_POOL_MAX_WORKERS;
  const requestTimeout = DEFAULT_LLM_REQUEST_TIMEOUT_MS;
  const defaultHardTimeout = Math.max(
    requestTimeout + DEFAULT_LLM_HARD_TIMEOUT_BUFFER_MS,
    DEFAULT_LLM_HARD_REQUEST_TIMEOUT_MS,
  );

  return {
    maxWorkers,
    providerMaxWorkers: normalizeProviderMaxWorkers(
      maxWorkers,
      config.providerMaxWorkers,
    ),
    hardRequestTimeout: config.hardRequestTimeout || defaultHardTimeout,
  };
}

function resolveErrorCode(error: unknown): string {
  if (error instanceof DeepSeekError || error instanceof QwenError) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

function isTimeoutErrorCode(code: string): boolean {
  return (
    code === DeepSeekErrorCode.TIMEOUT_ERROR ||
    code === QwenErrorCode.TIMEOUT_ERROR
  );
}

function buildTimeoutError(task: LLMProviderTask, timeoutMs: number): LLMProviderError {
  const message = `LLM request hard-timeout after ${timeoutMs}ms`;
  if (task.providerKey === "deepseek") {
    return new DeepSeekError(DeepSeekErrorCode.TIMEOUT_ERROR, message);
  }
  return new QwenError(QwenErrorCode.TIMEOUT_ERROR, message);
}

function buildProviderInput(task: LLMProviderTask): LLMProviderInput {
  switch (task.requestType) {
    case "text": {
      const payload = task.payload as TextTaskPayload;
      if (!payload || typeof payload.html !== "string") {
        throw new Error(`Invalid text payload for request ${task.requestId}`);
      }
      return {
        requestType: "text",
        accessionNumber: task.requestId,
        requestId: task.requestId,
        html: payload.html,
      };
    }
    case "vision": {
      const payload = task.payload as VisionTaskPayload;
      if (!payload || !Array.isArray(payload.imageUrls)) {
        throw new Error(`Invalid vision payload for request ${task.requestId}`);
      }
      return {
        requestType: "vision",
        accessionNumber: task.requestId,
        requestId: task.requestId,
        imageUrls: payload.imageUrls,
      };
    }
    case "pdf": {
      const payload = task.payload as PdfTaskPayload;
      if (!payload || typeof payload.pdfDataUrl !== "string") {
        throw new Error(`Invalid PDF payload for request ${task.requestId}`);
      }
      return {
        requestType: "pdf",
        accessionNumber: task.requestId,
        requestId: task.requestId,
        pdfDataUrl: payload.pdfDataUrl,
      };
    }
    default:
      throw new Error(`Unsupported requestType for request ${task.requestId}`);
  }
}

/**
 * LLM Worker Pool for handling concurrent provider tasks
 */
export class LLMWorkerPool {
  private readonly config: LLMWorkerPoolConfig;
  private readonly registry: ProviderRegistry;
  private queue: LLMRequest[] = [];
  private activeWorkers = 0;
  private activeByProvider: Record<ProviderName, number> = {
    deepseek: 0,
    "qwen-vl": 0,
    gpt: 0,
  };
  private isShuttingDown = false;

  constructor(
    config: Partial<LLMWorkerPoolConfig> = {},
    registry: ProviderRegistry = createDefaultProviderRegistry(),
  ) {
    this.config = resolveConfig(config);
    this.registry = registry;

    logger.info(
      `LLM Worker Pool initialized (global=${this.config.maxWorkers}, deepseek=${this.config.providerMaxWorkers.deepseek}, qwen-vl=${this.config.providerMaxWorkers["qwen-vl"]}, gpt=${this.config.providerMaxWorkers.gpt})`,
    );
  }

  /**
   * New provider-task API.
   */
  async processProviderTask(task: LLMProviderTask): Promise<unknown> {
    if (this.isShuttingDown) {
      throw new Error("Worker pool is shutting down");
    }

    const provider = this.registry.getProvider(task.providerKey);
    return new Promise((resolve, reject) => {
      const request: LLMRequest = {
        task,
        provider,
        resolve,
        reject,
        retries: 0,
      };
      this.queue.push(request);
      this.processQueue();
    });
  }

  /**
   * Backward-compatible wrapper for legacy call sites.
   */
  async processRequest(
    id: string,
    html: string,
    isVisionModel: boolean = false,
    imageUrls: string[] = [],
  ): Promise<unknown> {
    if (isVisionModel) {
      return this.processProviderTask({
        requestId: id,
        providerKey: "qwen-vl",
        requestType: "vision",
        payload: { imageUrls },
      });
    }

    return this.processProviderTask({
      requestId: id,
      providerKey: "deepseek",
      requestType: "text",
      payload: { html },
    });
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.activeWorkers < this.config.maxWorkers) {
      const nextIndex = this.queue.findIndex((request) => {
        const providerName = request.provider.config.providerName;
        return (
          this.activeByProvider[providerName] <
          this.config.providerMaxWorkers[providerName]
        );
      });

      if (nextIndex === -1) {
        return;
      }

      const [request] = this.queue.splice(nextIndex, 1);
      void this.startWorker(request);
    }
  }

  private async startWorker(request: LLMRequest): Promise<void> {
    const providerName = request.provider.config.providerName;
    this.activeWorkers++;
    this.activeByProvider[providerName]++;

    await withLogMetadata({ correlationId: request.task.requestId }, async () => {
      try {
        logger.debug(
          `Worker started for ${request.task.requestId} (provider=${providerName}, active=${this.activeWorkers}/${this.config.maxWorkers})`,
        );

        const result = await withTimeout(
          () => this.executeRequest(request),
          this.config.hardRequestTimeout,
          () => buildTimeoutError(request.task, this.config.hardRequestTimeout),
        );
        request.resolve(result);
      } catch (error) {
        this.handleRequestError(request, error);
      } finally {
        this.activeWorkers--;
        this.activeByProvider[providerName]--;
        this.processQueue();
      }
    });
  }

  private async executeRequest(request: LLMRequest): Promise<unknown> {
    const input = buildProviderInput(request.task);
    return request.provider.execute(input as never);
  }

  private handleRequestError(request: LLMRequest, error: unknown): void {
    const mappedError = request.provider.mapError(error);

    if (this.shouldRetryRequest(request, mappedError)) {
      this.retryRequest(request, mappedError);
      return;
    }

    this.logFinalFailure(request, mappedError);
    request.reject(mappedError);
  }

  private shouldRetryRequest(request: LLMRequest, error: Error): boolean {
    const maxRetries = request.provider.config.maxRetries;
    const errorCode = resolveErrorCode(error);

    return (
      request.provider.isRetryable(error) &&
      !isTimeoutErrorCode(errorCode) &&
      request.retries < maxRetries
    );
  }

  private retryRequest(request: LLMRequest, error: Error): void {
    const maxRetries = request.provider.config.maxRetries;
    request.retries++;

    const delayMs = computeRetryDelayMs(
      request.provider.config.retryBaseDelayMs,
      request.retries,
      "exponential",
    );

    logger.warn(
      `Retrying ${request.task.requestId} (provider=${request.provider.config.providerName}, attempt ${request.retries}/${maxRetries}) in ${delayMs}ms - ${resolveErrorCode(error)}: ${error.message}`,
    );

    setTimeout(() => {
      this.queue.unshift(request);
      this.processQueue();
    }, delayMs);
  }

  private logFinalFailure(request: LLMRequest, error: Error): void {
    const providerName = request.provider.config.providerName;
    const errorCode = resolveErrorCode(error);
    const maxRetries = request.provider.config.maxRetries;

    if (!request.provider.isRetryable(error)) {
      logger.error(
        `Request ${request.task.requestId} failed with non-retryable error (provider=${providerName}) - ${errorCode}: ${error.message}`,
      );
      return;
    }

    logger.error(
      `Request ${request.task.requestId} failed after ${maxRetries} retries (provider=${providerName}) - ${errorCode}: ${error.message}`,
    );
  }

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
 * If config/registry is provided after initialization, it is ignored.
 */
export function getLLMWorkerPool(
  config: Partial<LLMWorkerPoolConfig> = {},
  registry?: ProviderRegistry,
): LLMWorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new LLMWorkerPool(config, registry);
    return globalWorkerPool;
  }

  if (Object.keys(config).length > 0 || registry) {
    logger.warn(
      "LLM Worker Pool already initialized; ignoring new config/registry",
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
