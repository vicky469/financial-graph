import { createLogger } from "../utils/logger";
import { parseSubsidiaryJsonResponse } from "./llm-json";
import { buildSubsidiaryExtractionPrompt } from "./subsidiary-prompt";
import { QwenError, QwenErrorCode, QwenParseResponse, QwenRequestOptions } from "./qwen";
import {
  buildRawResponsePreview,
  writeRawResponseSnapshot,
} from "./llm-debug";

const logger = createLogger("integration/gpt");

const DEFAULT_GPT_MODEL = "openai/gpt-4.1";
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 12000;
const MAX_HTML_CHARS = 50000;

// Rate limiting state (shared with qwen.ts for now)
let gptRequestQueue: Promise<void> = Promise.resolve();
let lastGptRequestStartedAt = 0;
const GPT_MIN_REQUEST_INTERVAL_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGptRateLimit<T>(operation: () => Promise<T>): Promise<T> {
  let releaseQueue: (() => void) | undefined;
  const previousQueue = gptRequestQueue;
  gptRequestQueue = new Promise<void>((resolve) => {
    releaseQueue = () => resolve();
  });

  await previousQueue;

  try {
    const elapsedSinceLastStart = Date.now() - lastGptRequestStartedAt;
    const waitMs = GPT_MIN_REQUEST_INTERVAL_MS - elapsedSinceLastStart;
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    lastGptRequestStartedAt = Date.now();
    return await operation();
  } finally {
    releaseQueue?.();
  }
}

function buildTextPrompt(html: string): string {
  return `${buildSubsidiaryExtractionPrompt("text")}

HTML:
${html.substring(0, MAX_HTML_CHARS)}`;
}

export async function callGPT4ForSubsidiaries(
  html: string,
  options: QwenRequestOptions = {},
): Promise<QwenParseResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new QwenError(
      QwenErrorCode.AUTH_FAILED,
      "OPENROUTER_API_KEY environment variable not set",
    );
  }

  const {
    requestTimeout = 45000,
    model = process.env.OPENROUTER_TEXT_MODEL || DEFAULT_GPT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    accessionNumber,
  } = options;

  return withGptRateLimit(async () => {
    const prompt = buildTextPrompt(html);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const messages = [
        {
          role: "user",
          content: prompt,
        },
      ];

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/your-repo",
          "X-Title": "Financial Graph Subsidiary Parser",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        const statusText = response.statusText;
        const message = `GPT API error: ${status} ${statusText}`;
        const responseBody = await response.text();

        logger.error("GPT non-OK response", {
          provider: "gpt",
          requestType: "text",
          accessionNumber,
          status,
          statusText,
          model,
          responseBodyPreview: buildRawResponsePreview(responseBody || "<empty>"),
        });

        switch (status) {
          case 400:
            throw new QwenError(
              QwenErrorCode.INVALID_FORMAT,
              message,
              undefined,
              status,
            );
          case 401:
            throw new QwenError(
              QwenErrorCode.AUTH_FAILED,
              message,
              undefined,
              status,
            );
          case 402:
            throw new QwenError(
              QwenErrorCode.INSUFFICIENT_BALANCE,
              message,
              undefined,
              status,
            );
          case 403:
            throw new QwenError(
              QwenErrorCode.AUTH_FAILED,
              message,
              undefined,
              status,
            );
          case 422:
            throw new QwenError(
              QwenErrorCode.INVALID_PARAMS,
              message,
              undefined,
              status,
            );
          case 429:
            throw new QwenError(
              QwenErrorCode.RATE_LIMIT,
              message,
              undefined,
              status,
            );
          case 500:
            throw new QwenError(
              QwenErrorCode.SERVER_ERROR,
              message,
              undefined,
              status,
            );
          case 503:
            throw new QwenError(
              QwenErrorCode.SERVER_OVERLOADED,
              message,
              undefined,
              status,
            );
          default:
            throw new QwenError(
              QwenErrorCode.UNKNOWN_ERROR,
              message,
              undefined,
              status,
            );
        }
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new QwenError(
          QwenErrorCode.NO_CONTENT_ERROR,
          "No content in GPT API response",
        );
      }

      try {
        const parsed = parseSubsidiaryJsonResponse<QwenParseResponse>(content);
        if (parsed.recovered) {
          logger.warn("GPT response required JSON recovery", {
            provider: "gpt",
            requestType: "text",
            accessionNumber,
            model,
            recoveredCount: parsed.recoveredCount,
          });
        }
        return parsed.value;
      } catch (parseError) {
        const rawResponsePath = await writeRawResponseSnapshot({
          provider: "gpt",
          model,
          requestType: "text",
          accessionNumber,
          reason: "json_parse_error",
          content,
        });
        logger.error("GPT JSON parse failed", {
          provider: "gpt",
          requestType: "text",
          accessionNumber,
          model,
          parseError:
            parseError instanceof Error ? parseError.message : String(parseError),
          rawResponsePreview: buildRawResponsePreview(content),
          rawResponsePath,
        });
        throw new QwenError(
          QwenErrorCode.JSON_PARSE_ERROR,
          `JSON Parse error: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`,
          parseError instanceof Error ? parseError : undefined,
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof QwenError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new QwenError(
          QwenErrorCode.TIMEOUT_ERROR,
          `Request timeout after ${requestTimeout}ms`,
          error,
        );
      }

      logger.warn("GPT request failed", {
        provider: "gpt",
        requestType: "text",
        accessionNumber,
        error: error instanceof Error ? error.message : String(error),
        model,
      });

      throw new QwenError(
        QwenErrorCode.NETWORK_ERROR,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
      );
    }
  });
}
