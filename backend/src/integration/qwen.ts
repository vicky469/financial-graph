import { createLogger } from "../utils/logger";
import { SEC_USER_AGENT } from "../config/config";
import { parseSubsidiaryJsonResponse } from "./llm-json";
import { buildSubsidiaryExtractionPrompt } from "./subsidiary-prompt";
import {
  buildRawResponsePreview,
  writeRawResponseSnapshot,
} from "./llm-debug";

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

const DEFAULT_VISION_MODEL = "qwen/qwen-2-vl-72b-instruct"; // Qwen vision model via OpenRouter
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 12000;
const DEFAULT_QWEN_SEC_REQUESTS_PER_SECOND = 1000 / 1500;
const DEFAULT_SEC_IMAGE_FETCH_TIMEOUT_MS = 12000;
const DEFAULT_SEC_IMAGE_FETCH_DELAY_MS = 250;
const SEC_IMAGE_FETCH_MAX_RETRIES = 3;

let qwenRequestQueue: Promise<void> = Promise.resolve();
let lastQwenRequestStartedAt = 0;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const qwenSecRequestsPerSecond = parsePositiveNumber(
  process.env.QWEN_SEC_REQUESTS_PER_SECOND,
  DEFAULT_QWEN_SEC_REQUESTS_PER_SECOND,
);
if (process.env.QWEN_SEC_REQUESTS_PER_SECOND) {
  const configured = Number(process.env.QWEN_SEC_REQUESTS_PER_SECOND);
  if (!Number.isFinite(configured) || configured <= 0) {
    logger.warn("Invalid QWEN_SEC_REQUESTS_PER_SECOND; expected positive number", {
      configuredValue: process.env.QWEN_SEC_REQUESTS_PER_SECOND,
      fallback: String(DEFAULT_QWEN_SEC_REQUESTS_PER_SECOND),
    });
  }
}

const resolvedQwenMinRequestIntervalMs = Math.max(
  1,
  Math.ceil(1000 / qwenSecRequestsPerSecond),
);

const QWEN_EFFECTIVE_REQUESTS_PER_SECOND = Number(
  (1000 / resolvedQwenMinRequestIntervalMs).toFixed(4),
);
const SEC_IMAGE_FETCH_TIMEOUT_MS = parsePositiveInt(
  process.env.SEC_IMAGE_FETCH_TIMEOUT_MS,
  DEFAULT_SEC_IMAGE_FETCH_TIMEOUT_MS,
);
const SEC_IMAGE_FETCH_DELAY_MS = parsePositiveInt(
  process.env.SEC_IMAGE_FETCH_DELAY_MS,
  DEFAULT_SEC_IMAGE_FETCH_DELAY_MS,
);
const QWEN_INLINE_SEC_IMAGE_URLS = parseBoolean(
  process.env.QWEN_INLINE_SEC_IMAGE_URLS,
  true,
);
const OPENROUTER_MAX_RETRIES = parsePositiveInt(process.env.QWEN_MAX_RETRIES, 2);
const OPENROUTER_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.QWEN_RETRY_BASE_DELAY_MS,
  1500,
);

logger.info("Configured Qwen SEC throttle", {
  source: "QWEN_SEC_REQUESTS_PER_SECOND",
  requestsPerSecond: String(QWEN_EFFECTIVE_REQUESTS_PER_SECOND),
  minRequestIntervalMs: String(resolvedQwenMinRequestIntervalMs),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callQwenWithRetries<T>(
  accessionNumber: string,
  requestType: OpenRouterRequestType,
  request: () => Promise<T>,
): Promise<T> {
  let attempts = 0;

  for (;;) {
    try {
      return await request();
    } catch (error) {
      if (
        !(error instanceof QwenError) ||
        !error.isRetryable ||
        attempts >= OPENROUTER_MAX_RETRIES
      ) {
        throw error;
      }

      attempts += 1;
      const delayMs = OPENROUTER_RETRY_BASE_DELAY_MS * 2 ** (attempts - 1);
      logger.warn(
        `Retrying OpenRouter ${requestType} request for ${accessionNumber} (attempt ${attempts}/${OPENROUTER_MAX_RETRIES}) in ${delayMs}ms due to ${error.code}`,
        {
          provider: "openrouter",
          requestType,
          accessionNumber,
          retryAttempt: String(attempts),
          maxRetries: String(OPENROUTER_MAX_RETRIES),
          retryDelayMs: String(delayMs),
          errorCode: error.code,
        },
      );
      await sleep(delayMs);
    }
  }
}

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
    if (attempt > 0) {
      const retryDelayMs = SEC_IMAGE_FETCH_DELAY_MS * 2 ** attempt;
      await sleep(retryDelayMs);
    } else {
      await sleep(SEC_IMAGE_FETCH_DELAY_MS);
    }

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
    requestTimeout = 30000,
    model = DEFAULT_VISION_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    pdfUrl,
    accessionNumber,
  } = options;
  const requestType: OpenRouterRequestType = pdfUrl ? "pdf" : "vision";

  return withQwenRateLimit(async () => {
    const prompt = buildVisionPrompt();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

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

      try {
        const parsed = parseSubsidiaryJsonResponse<QwenParseResponse>(
          content_response,
        );
        if (parsed.recovered) {
          logger.warn("Qwen response required JSON recovery", {
            provider: "qwen-vl",
            model,
            requestType,
            accessionNumber,
            recoveredCount: parsed.recoveredCount,
          });
        }
        return parsed.value;
      } catch (parseError) {
        const rawResponsePath = await writeRawResponseSnapshot({
          provider: "qwen-vl",
          model,
          requestType,
          accessionNumber,
          reason: "json_parse_error",
          content: content_response,
        });
        const rawResponsePreview = buildRawResponsePreview(content_response);
        logger.error("Qwen JSON parse failed", {
          provider: "qwen-vl",
          model,
          requestType,
          accessionNumber,
          parseError:
            parseError instanceof Error ? parseError.message : String(parseError),
          rawResponsePreview,
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
  });
}
