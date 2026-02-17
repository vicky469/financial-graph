import { createLogger } from "../utils/logger";
import { buildSubsidiaryTextPrompt } from "./subsidiary-prompt";
import {
  buildRawResponsePreview,
} from "./llm-debug";
import { parseSubsidiaryContentOrThrow } from "./subsidiary-response";
import { DEFAULT_LLM_REQUEST_TIMEOUT_MS } from "./llm-constants";

const logger = createLogger("integration/deepseek");

export enum DeepSeekErrorCode {
  // Network/Infrastructure errors (retryable)
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  SERVER_OVERLOADED = "SERVER_OVERLOADED",
  RATE_LIMIT = "RATE_LIMIT",

  // Client errors (non-retryable)
  INVALID_FORMAT = "INVALID_FORMAT",
  AUTH_FAILED = "AUTH_FAILED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_PARAMS = "INVALID_PARAMS",

  // Our internal parsing errors (non-retryable)
  JSON_PARSE_ERROR = "JSON_PARSE_ERROR",
  NO_CONTENT_ERROR = "NO_CONTENT_ERROR",

  // Unknown errors (non-retryable by default)
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class DeepSeekError extends Error {
  constructor(
    public code: DeepSeekErrorCode,
    message: string,
    public originalError?: Error,
    public httpStatus?: number,
  ) {
    super(message);
    this.name = "DeepSeekError";
  }

  get isRetryable(): boolean {
    return [
      DeepSeekErrorCode.NETWORK_ERROR,
      DeepSeekErrorCode.TIMEOUT_ERROR,
      DeepSeekErrorCode.SERVER_ERROR,
      DeepSeekErrorCode.SERVER_OVERLOADED,
      DeepSeekErrorCode.RATE_LIMIT,
    ].includes(this.code);
  }
}

export interface DeepSeekSubsidiaryRecord {
  name: string;
  jurisdiction?: string | null;
  ownership_percentage?: number | null;
}

export interface DeepSeekParseResponse {
  subsidiaries: DeepSeekSubsidiaryRecord[];
}

export type DeepSeekRequestOptions = {
  requestTimeout?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  accessionNumber?: string;
};

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 8000; // Output tokens limit
const DEEPSEEK_MAX_OUTPUT_TOKENS_LIMIT = 8192; // DeepSeek API output token limit

export async function callDeepSeekForSubsidiaries(
  html: string,
  options: DeepSeekRequestOptions = {},
): Promise<DeepSeekParseResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError(
      DeepSeekErrorCode.AUTH_FAILED,
      "DEEPSEEK_API_KEY environment variable not set",
    );
  }

  const {
    requestTimeout,
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    accessionNumber,
  } = options;
  const resolvedRequestTimeout = requestTimeout ?? DEFAULT_LLM_REQUEST_TIMEOUT_MS;
  const boundedMaxTokens = Math.min(
    DEEPSEEK_MAX_OUTPUT_TOKENS_LIMIT,
    Math.max(1, Math.floor(maxTokens)),
  );

  if (boundedMaxTokens !== maxTokens) {
    logger.warn("Adjusted DeepSeek max_tokens to provider limit", {
      provider: "deepseek",
      model,
      requestType: "text",
      accessionNumber,
      requestedMaxTokens: maxTokens,
      boundedMaxTokens,
    });
  }

  const prompt = buildSubsidiaryTextPrompt(html);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), resolvedRequestTimeout);

  try {
    const messages = [
      {
        role: "user",
        content: prompt,
      },
    ];

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: boundedMaxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;
      const message = `DeepSeek API error: ${status} ${statusText}`;
      const responseBody = await response.text();

      logger.error("DeepSeek API non-OK response", {
        provider: "deepseek",
        model,
        requestType: "text",
        accessionNumber,
        status,
        statusText,
        responseBodyPreview: buildRawResponsePreview(responseBody || "<empty>"),
      });

      switch (status) {
        case 400:
          throw new DeepSeekError(
            DeepSeekErrorCode.INVALID_FORMAT,
            message,
            undefined,
            status,
          );
        case 401:
          throw new DeepSeekError(
            DeepSeekErrorCode.AUTH_FAILED,
            message,
            undefined,
            status,
          );
        case 402:
          throw new DeepSeekError(
            DeepSeekErrorCode.INSUFFICIENT_BALANCE,
            message,
            undefined,
            status,
          );
        case 422:
          throw new DeepSeekError(
            DeepSeekErrorCode.INVALID_PARAMS,
            message,
            undefined,
            status,
          );
        case 429:
          throw new DeepSeekError(
            DeepSeekErrorCode.RATE_LIMIT,
            message,
            undefined,
            status,
          );
        case 500:
          throw new DeepSeekError(
            DeepSeekErrorCode.SERVER_ERROR,
            message,
            undefined,
            status,
          );
        case 503:
          throw new DeepSeekError(
            DeepSeekErrorCode.SERVER_OVERLOADED,
            message,
            undefined,
            status,
          );
        default:
          throw new DeepSeekError(
            DeepSeekErrorCode.UNKNOWN_ERROR,
            message,
            undefined,
            status,
          );
      }
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new DeepSeekError(
        DeepSeekErrorCode.NO_CONTENT_ERROR,
        "No content in DeepSeek API response",
      );
    }

    return parseSubsidiaryContentOrThrow<DeepSeekParseResponse, DeepSeekError>(
      content,
      {
        provider: "deepseek",
        providerLabel: "DeepSeek",
        model,
        requestType: "text",
        accessionNumber,
        logger,
      },
      (message, parseError) =>
        new DeepSeekError(
          DeepSeekErrorCode.JSON_PARSE_ERROR,
          message,
          parseError instanceof Error ? parseError : undefined,
        ),
    );
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DeepSeekError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DeepSeekError(
        DeepSeekErrorCode.TIMEOUT_ERROR,
        `Request timeout after ${resolvedRequestTimeout}ms`,
        error,
      );
    }

    logger.warn("DeepSeek request failed", {
      provider: "deepseek",
      model,
      requestType: "text",
      accessionNumber,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new DeepSeekError(
      DeepSeekErrorCode.NETWORK_ERROR,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
    );
  }
}
