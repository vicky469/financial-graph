import { createLogger } from "../utils/logger";
import { parseSubsidiaryJsonResponse } from "./llm-json";
import { buildSubsidiaryExtractionPrompt } from "./subsidiary-prompt";
import {
  buildRawResponsePreview,
  writeRawResponseSnapshot,
} from "./llm-debug";

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
const MAX_HTML_CHARS = 50000;

function buildPrompt(html: string): string {
  return `${buildSubsidiaryExtractionPrompt("text")}

HTML:
${html.substring(0, MAX_HTML_CHARS)}`;
}

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
    requestTimeout = 30000,
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    accessionNumber,
  } = options;
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

  const prompt = buildPrompt(html);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

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

    try {
      const parsed = parseSubsidiaryJsonResponse<DeepSeekParseResponse>(content);
      if (parsed.recovered) {
        logger.warn("DeepSeek response required JSON recovery", {
          provider: "deepseek",
          model,
          requestType: "text",
          accessionNumber,
          recoveredCount: parsed.recoveredCount,
        });
      }
      return parsed.value;
    } catch (parseError) {
      const rawResponsePath = await writeRawResponseSnapshot({
        provider: "deepseek",
        model,
        requestType: "text",
        accessionNumber,
        reason: "json_parse_error",
        content,
      });
      const rawResponsePreview = buildRawResponsePreview(content);
      logger.error("DeepSeek JSON parse failed", {
        provider: "deepseek",
        model,
        requestType: "text",
        accessionNumber,
        parseError:
          parseError instanceof Error ? parseError.message : String(parseError),
        rawResponsePreview,
        rawResponsePath,
      });
      throw new DeepSeekError(
        DeepSeekErrorCode.JSON_PARSE_ERROR,
        `JSON Parse error: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`,
        parseError instanceof Error ? parseError : undefined,
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DeepSeekError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DeepSeekError(
        DeepSeekErrorCode.TIMEOUT_ERROR,
        `Request timeout after ${requestTimeout}ms`,
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
