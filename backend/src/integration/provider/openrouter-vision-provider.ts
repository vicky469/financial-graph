import {
  callQwenForSubsidiaries,
  QwenError,
  QwenErrorCode,
} from "../qwen";
import { BaseLLMProvider } from "./base-provider";
import {
  LLMProviderConfig,
  LLMProviderParseResponse,
  PdfProviderInput,
  VisionProviderInput,
} from "./types";
import { DEFAULT_LLM_REQUEST_TIMEOUT_MS } from "../llm-constants";

const DEFAULT_MODEL = "qwen/qwen3.5-397b-a17b";
const DEFAULT_TIMEOUT_MS = DEFAULT_LLM_REQUEST_TIMEOUT_MS;
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 12000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_RETRY_BASE_DELAY_MS = 1500;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function createOpenRouterVisionProviderConfig(): LLMProviderConfig {
  return {
    providerName: "qwen-vl",
    modelName: process.env.OPENROUTER_VISION_MODEL || DEFAULT_MODEL,
    url: OPENROUTER_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    maxRetries: DEFAULT_MAX_RETRIES,
    retryBaseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
  };
}

type OpenRouterVisionRequest = {
  requestType: "vision" | "pdf";
  requestId: string;
  imageUrls: string[];
  pdfUrl?: string;
};

function isVisionInput(
  input: VisionProviderInput | PdfProviderInput,
): input is VisionProviderInput {
  return input.requestType === "vision";
}

export class OpenRouterVisionProvider extends BaseLLMProvider<
  VisionProviderInput | PdfProviderInput
> {
  constructor(config: LLMProviderConfig = createOpenRouterVisionProviderConfig()) {
    super(config);
  }

  protected buildRequest(
    input: VisionProviderInput | PdfProviderInput,
  ): OpenRouterVisionRequest {
    const requestId = input.requestId || input.accessionNumber;
    if (isVisionInput(input)) {
      return {
        requestType: "vision",
        requestId,
        imageUrls: input.imageUrls,
      };
    }

    return {
      requestType: "pdf",
      requestId,
      imageUrls: [],
      pdfUrl: input.pdfDataUrl,
    };
  }

  protected async executeRequest(request: unknown): Promise<unknown> {
    const typedRequest = request as OpenRouterVisionRequest;
    return callQwenForSubsidiaries(typedRequest.imageUrls, {
      accessionNumber: typedRequest.requestId,
      model: this.config.modelName,
      requestTimeout: this.config.timeoutMs,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      pdfUrl: typedRequest.pdfUrl,
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
