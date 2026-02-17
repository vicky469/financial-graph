import {
  callDeepSeekForSubsidiaries,
  DeepSeekError,
  DeepSeekErrorCode,
} from "../deepseek";
import { BaseLLMProvider } from "./base-provider";
import {
  LLMProviderConfig,
  LLMProviderParseResponse,
  TextProviderInput,
} from "./types";
import { DEFAULT_LLM_REQUEST_TIMEOUT_MS } from "../llm-constants";

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_TIMEOUT_MS = DEFAULT_LLM_REQUEST_TIMEOUT_MS;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export function createDeepSeekProviderConfig(): LLMProviderConfig {
  return {
    providerName: "deepseek",
    modelName: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    url: DEEPSEEK_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
  };
}

type DeepSeekRequest = {
  html: string;
  requestId: string;
};

export class DeepSeekProvider extends BaseLLMProvider<TextProviderInput> {
  constructor(config: LLMProviderConfig = createDeepSeekProviderConfig()) {
    super(config);
  }

  protected buildRequest(input: TextProviderInput): DeepSeekRequest {
    return {
      html: input.html,
      requestId: input.requestId || input.accessionNumber,
    };
  }

  protected async executeRequest(request: unknown): Promise<unknown> {
    const typedRequest = request as DeepSeekRequest;
    return callDeepSeekForSubsidiaries(typedRequest.html, {
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
    return error instanceof DeepSeekError && error.isRetryable;
  }

  mapError(error: unknown): Error {
    if (error instanceof DeepSeekError) {
      return error;
    }
    if (error instanceof Error) {
      return new DeepSeekError(DeepSeekErrorCode.UNKNOWN_ERROR, error.message, error);
    }
    return new DeepSeekError(
      DeepSeekErrorCode.UNKNOWN_ERROR,
      String(error),
    );
  }
}
