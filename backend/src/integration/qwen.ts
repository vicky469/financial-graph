import { createLogger } from "../utils/logger";
import { SEC_USER_AGENT } from "../config/config";
import { buildSubsidiaryExtractionPrompt } from "./subsidiary-prompt";
import {
  buildRawResponsePreview,
} from "./llm-debug";
import { parseSubsidiaryContentOrThrow } from "./subsidiary-response";
import {
  DEFAULT_LLM_HARD_REQUEST_TIMEOUT_MS,
  DEFAULT_LLM_REQUEST_TIMEOUT_MS,
} from "./llm-constants";
import {
  computeRetryDelayMs,
  sleep,
  withTimeout,
} from "../utils/async-control";

const logger = createLogger("integration/qwen");

export enum QwenErrorCode {
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

export class QwenError extends Error {
  constructor(
    public code: QwenErrorCode,
    message: string,
    public originalError?: Error,
    public httpStatus?: number,
  ) {
    super(message);
    this.name = "QwenError";
  }

  get isRetryable(): boolean {
    return [
      QwenErrorCode.NETWORK_ERROR,
      QwenErrorCode.TIMEOUT_ERROR,
      QwenErrorCode.SERVER_ERROR,
      QwenErrorCode.SERVER_OVERLOADED,
      QwenErrorCode.RATE_LIMIT,
    ].includes(this.code);
  }
}

export interface QwenSubsidiaryRecord {
  name: string;
  jurisdiction?: string | null;
  ownership_percentage?: number | null;
}

export interface QwenParseResponse {
  subsidiaries: QwenSubsidiaryRecord[];
}

export type OpenRouterRequestType = "pdf" | "vision" | "text";

export type QwenRequestOptions = {
  requestTimeout?: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  imageUrls?: string[]; // Image URLs for vision model
  pdfUrl?: string; // PDF URL for document parsing
  accessionNumber?: string;
};

const DEFAULT_VISION_MODEL = "qwen/qwen3.5-397b-a17b"; // Qwen vision model via OpenRouter
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 12000;
const DEFAULT_QWEN_SEC_REQUESTS_PER_SECOND = 1000 / 1500;
const DEFAULT_SEC_IMAGE_FETCH_TIMEOUT_MS = 12000;
const DEFAULT_SEC_IMAGE_FETCH_DELAY_MS = 250;
const SEC_IMAGE_FETCH_MAX_RETRIES = 3;
const QWEN_INLINE_SEC_IMAGE_URLS = true;

let qwenRequestQueue: Promise<void> = Promise.resolve();
let lastQwenRequestStartedAt = 0;
const qwenSecRequestsPerSecond = DEFAULT_QWEN_SEC_REQUESTS_PER_SECOND;

const resolvedQwenMinRequestIntervalMs = Math.max(
  1,
  Math.ceil(1000 / qwenSecRequestsPerSecond),
);

const QWEN_EFFECTIVE_REQUESTS_PER_SECOND = Number(
  (1000 / resolvedQwenMinRequestIntervalMs).toFixed(4),
);
const SEC_IMAGE_FETCH_TIMEOUT_MS = DEFAULT_SEC_IMAGE_FETCH_TIMEOUT_MS;
const SEC_IMAGE_FETCH_DELAY_MS = DEFAULT_SEC_IMAGE_FETCH_DELAY_MS;

logger.info("Configured Qwen SEC throttle", {
  requestsPerSecond: String(QWEN_EFFECTIVE_REQUESTS_PER_SECOND),
  minRequestIntervalMs: String(resolvedQwenMinRequestIntervalMs),
});

async function withQwenRateLimit<T>(operation: () => Promise<T>): Promise<T> {
  let releaseQueue: (() => void) | undefined;
  const previousQueue = qwenRequestQueue;
  qwenRequestQueue = new Promise<void>((resolve) => {
    releaseQueue = () => resolve();
  });

  await previousQueue;

  try {
    const elapsedSinceLastStart = Date.now() - lastQwenRequestStartedAt;
    const waitMs = resolvedQwenMinRequestIntervalMs - elapsedSinceLastStart;
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    lastQwenRequestStartedAt = Date.now();
    return await operation();
  } finally {
    releaseQueue?.();
  }
}

function isSecUpstreamForbidden(status: number, responseBody: string): boolean {
  if (status !== 400 && status !== 403) return false;
  const normalized = responseBody.toLowerCase();
  return normalized.includes("sec.gov") && normalized.includes("forbidden");
}

function isSecArchivesUrl(url: string): boolean {
  return /^https:\/\/www\.sec\.gov\/archives\/edgar\/data\//i.test(url);
}

function inferMimeType(url: string, contentTypeHeader: string | null): string {
  if (contentTypeHeader && contentTypeHeader.includes("/")) {
    return contentTypeHeader.split(";")[0].trim();
  }

  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return "image/jpeg";
}

async function fetchSecImageAsDataUrl(url: string): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < SEC_IMAGE_FETCH_MAX_RETRIES; attempt++) {
    const retryDelayMs = computeRetryDelayMs(
      SEC_IMAGE_FETCH_DELAY_MS,
      attempt + 1,
      "exponential",
    );
    await sleep(retryDelayMs);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      SEC_IMAGE_FETCH_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": SEC_USER_AGENT,
          Accept: "image/*,*/*",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const bodyPreview = buildRawResponsePreview(await response.text(), 500);
        const status = response.status;
        const retryable = status === 403 || status === 429 || status >= 500;

        if (retryable && attempt < SEC_IMAGE_FETCH_MAX_RETRIES - 1) {
          continue;
        }

        throw new QwenError(
          retryable ? QwenErrorCode.RATE_LIMIT : QwenErrorCode.INVALID_FORMAT,
          `SEC image fetch failed: ${status} ${response.statusText} for ${url} | ${bodyPreview}`,
          undefined,
          status,
        );
      }

      const mimeType = inferMimeType(url, response.headers.get("content-type"));
      const data = Buffer.from(await response.arrayBuffer()).toString("base64");
      return `data:${mimeType};base64,${data}`;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof QwenError) {
        lastError = error;
        break;
      }

      if (error instanceof Error && error.name === "AbortError") {
        lastError = new QwenError(
          QwenErrorCode.TIMEOUT_ERROR,
          `SEC image fetch timed out after ${SEC_IMAGE_FETCH_TIMEOUT_MS}ms for ${url}`,
          error,
        );
      } else {
        lastError = new QwenError(
          QwenErrorCode.NETWORK_ERROR,
          `SEC image fetch failed for ${url}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error : undefined,
        );
      }

      if (attempt < SEC_IMAGE_FETCH_MAX_RETRIES - 1) {
        continue;
      }
    }
  }

  throw (
    lastError ??
    new QwenError(
      QwenErrorCode.NETWORK_ERROR,
      `SEC image fetch failed for ${url}`,
    )
  );
}

async function prepareImageInputs(imageUrls: string[]): Promise<string[]> {
  if (!QWEN_INLINE_SEC_IMAGE_URLS || imageUrls.length === 0) {
    return imageUrls;
  }

  const prepared: string[] = [];

  for (const imageUrl of imageUrls) {
    if (!isSecArchivesUrl(imageUrl)) {
      prepared.push(imageUrl);
      continue;
    }

    try {
      const dataUrl = await fetchSecImageAsDataUrl(imageUrl);
      prepared.push(dataUrl);
    } catch (error) {
      logger.warn("Failed to inline SEC image URL for Qwen request", {
        imageUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (prepared.length === 0 && imageUrls.length > 0) {
    throw new QwenError(
      QwenErrorCode.RATE_LIMIT,
      "No SEC image URLs could be fetched for Qwen request",
    );
  }

  if (prepared.length !== imageUrls.length) {
    logger.warn("Some SEC image URLs could not be fetched; continuing with subset", {
      originalCount: imageUrls.length,
      preparedCount: prepared.length,
    });
  }

  return prepared;
}

function buildVisionPrompt(): string {
  return buildSubsidiaryExtractionPrompt("vision");
}

export async function callQwenForSubsidiaries(
  imageUrls: string[],
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
    requestTimeout,
    model = DEFAULT_VISION_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    pdfUrl,
    accessionNumber,
  } = options;
  const resolvedRequestTimeout = requestTimeout ?? DEFAULT_LLM_REQUEST_TIMEOUT_MS;
  const requestType: OpenRouterRequestType = pdfUrl ? "pdf" : "vision";
  const operationTimeout = Math.max(
    resolvedRequestTimeout * 4,
    DEFAULT_LLM_HARD_REQUEST_TIMEOUT_MS,
  );

  return withQwenRateLimit(() =>
    withTimeout(
      () => (async () => {
        const prompt = buildVisionPrompt();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), resolvedRequestTimeout);

        try {
          // Build message content with text and images/PDF (OpenRouter format)
          const content: any[] = [{ type: "text", text: prompt }];

          // Add PDF if provided
          if (pdfUrl) {
            content.push({
              type: "file",
              file: {
                filename: "exhibit.pdf",
                file_data: pdfUrl,
              },
            });
          }

          // Add all image URLs
          const preparedImageUrls = await prepareImageInputs(imageUrls);
          for (const url of preparedImageUrls) {
            content.push({
              type: "image_url",
              image_url: { url },
            });
          }

          const messages = [
            {
              role: "user",
              content,
            },
          ];

          // OpenRouter API endpoint
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": "https://github.com/your-repo", // Optional: for rankings
              "X-Title": "Financial Graph Subsidiary Parser", // Optional: for rankings
            },
            body: JSON.stringify({
              model,
              messages,
              temperature,
              max_tokens: maxTokens,
              // Use mistral-ocr engine for better PDF parsing (especially for scanned documents)
              plugins: pdfUrl ? [
                {
                  id: "file-parser",
                  pdf: {
                    engine: "mistral-ocr", // Better for scanned/image-based PDFs
                  },
                },
              ] : undefined,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const status = response.status;
            const statusText = response.statusText;
            const message = `Qwen API error: ${status} ${statusText}`;
            const responseBody = await response.text();
            const secUpstreamForbidden = isSecUpstreamForbidden(status, responseBody);

            logger.error("Qwen API non-OK response", {
              provider: "qwen-vl",
              model,
              requestType,
              accessionNumber,
              status,
              statusText,
              responseBodyPreview: buildRawResponsePreview(responseBody || "<empty>"),
              secUpstreamForbidden,
            });

            switch (status) {
              case 400:
                if (secUpstreamForbidden) {
                  throw new QwenError(
                    QwenErrorCode.RATE_LIMIT,
                    `${message} (provider failed to fetch SEC resource)`,
                    undefined,
                    status,
                  );
                }
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
                if (secUpstreamForbidden) {
                  throw new QwenError(
                    QwenErrorCode.RATE_LIMIT,
                    `${message} (provider failed to fetch SEC resource)`,
                    undefined,
                    status,
                  );
                }
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
          const content_response = data.choices?.[0]?.message?.content;

          if (!content_response) {
            throw new QwenError(
              QwenErrorCode.NO_CONTENT_ERROR,
              "No content in Qwen API response",
            );
          }

          return parseSubsidiaryContentOrThrow<QwenParseResponse, QwenError>(
            content_response,
            {
              provider: "qwen-vl",
              providerLabel: "Qwen",
              model,
              requestType,
              accessionNumber,
              logger,
            },
            (message, parseError) =>
              new QwenError(
                QwenErrorCode.JSON_PARSE_ERROR,
                message,
                parseError instanceof Error ? parseError : undefined,
              ),
          );
        } catch (error) {
          clearTimeout(timeoutId);

          if (error instanceof QwenError) {
            throw error;
          }

          if (error instanceof Error && error.name === "AbortError") {
            throw new QwenError(
              QwenErrorCode.TIMEOUT_ERROR,
              `Request timeout after ${resolvedRequestTimeout}ms`,
              error,
            );
          }

          logger.warn("Qwen request failed", {
            provider: "qwen-vl",
            model,
            requestType,
            accessionNumber,
            error: error instanceof Error ? error.message : String(error),
          });

          throw new QwenError(
            QwenErrorCode.NETWORK_ERROR,
            error instanceof Error ? error.message : String(error),
            error instanceof Error ? error : undefined,
          );
        }
      })(),
      operationTimeout,
      () =>
        new QwenError(
          QwenErrorCode.TIMEOUT_ERROR,
          `Qwen operation timeout after ${operationTimeout}ms`,
        ),
    ),
  );
}
