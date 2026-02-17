import { callGPT4ForSubsidiaries } from "../gpt";
import {
  QwenError,
  QwenErrorCode,
} from "../qwen";
import { BaseLLMProvider } from "./base-provider";
import {
  LLMProviderConfig,
  LLMProviderParseResponse,
  TextProviderInput,
} from "./types";
import { DEFAULT_LLM_REQUEST_TIMEOUT_MS } from "../llm-constants";

const DEFAULT_MODEL = "openai/gpt-5.2-codex";
const DEFAULT_TIMEOUT_MS = DEFAULT_LLM_REQUEST_TIMEOUT_MS;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 12000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_RETRY_BASE_DELAY_MS = 1500;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function createOpenRouterTextProviderConfig(): LLMProviderConfig {
  return {
    providerName: "gpt",
    modelName: process.env.OPENROUTER_TEXT_MODEL || DEFAULT_MODEL,
    url: OPENROUTER_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
  };
}

type OpenRouterTextRequest = {
  html: string;
  requestId: string;
};

export class OpenRouterTextProvider extends BaseLLMProvider<TextProviderInput> {
  constructor(config: LLMProviderConfig = createOpenRouterTextProviderConfig()) {
    super(config);
  }

  protected buildRequest(input: TextProviderInput): OpenRouterTextRequest {
    return {
      html: input.html,
      requestId: input.requestId || input.accessionNumber,
    };
  }

  protected async executeRequest(request: unknown): Promise<unknown> {
    const typedRequest = request as OpenRouterTextRequest;
    return callGPT4ForSubsidiaries(typedRequest.html, {
      accessionNumber: typedRequest.requestId,
      model: this.config.modelName,
      requestTimeout: this.config.timeoutMs,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });
  }

  protected parseResponse(response: unknown): LLMProviderParseResponse | null {
    return (response as LLMProviderParseResponse | null) ?? null;
  }

  isRetryable(error: unknown): boolean {
    return error instanceof QwenError && error.isRetryable;
  }

  mapError(error: unknown): Error {
    if (error instanceof QwenError) {
      return error;
    }
    if (error instanceof Error) {
      return new QwenError(QwenErrorCode.UNKNOWN_ERROR, error.message, error);
    }
    return new QwenError(QwenErrorCode.UNKNOWN_ERROR, String(error));
  }
}
