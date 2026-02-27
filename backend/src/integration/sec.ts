import { SEC_USER_AGENT } from "../config/config";
import { createLogger } from "../utils/logger";

const SEC_REQUEST_MAX_RETRIES = 3;
const SEC_REQUEST_DELAY_MS = 1000;
const SEC_REQUEST_MAX_BACKOFF_MS = 15000;

const logger = createLogger("integration/sec");

export enum SecFetchMode {
  JSON = "json",
  TEXT = "text",
  HTML = "html",
  PDF = "pdf",
  HTM = "htm",
}

type SecTextMode = Exclude<SecFetchMode, SecFetchMode.JSON | SecFetchMode.PDF>;
export type SecFetchResult<T, M extends SecFetchMode> = M extends SecFetchMode.PDF
  ? Buffer
  : M extends SecFetchMode.JSON
    ? T
    : string;

function buildSecHeaders(mode: SecFetchMode = SecFetchMode.TEXT): Headers {
  let acceptHeader: string;
  switch (mode) {
    case SecFetchMode.JSON:
      acceptHeader = "application/json";
      break;
    case SecFetchMode.PDF:
      acceptHeader = "application/pdf";
      break;
    default:
      // For plain text/htm we accept anything; SEC often returns text/html.
      acceptHeader = "*/*";
      break;
  }

  return new Headers({
    "User-Agent": SEC_USER_AGENT,
    "Accept-Encoding": "gzip, deflate",
    Accept: acceptHeader,
  });
}

export class SecFetchError extends Error {
  status: number;
  statusText: string;
  body?: string;

  constructor(status: number, statusText: string, body?: string) {
    super(`SEC fetch failed: ${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }

  const timestamp = Date.parse(trimmed);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.max(0, timestamp - Date.now());
}

async function parseSecResponse<T, M extends SecFetchMode>(
  response: Response,
  mode: M,
): Promise<SecFetchResult<T, M>> {
  switch (mode) {
    case SecFetchMode.PDF: {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer) as SecFetchResult<T, M>;
    }
    case SecFetchMode.JSON: {
      const raw = await response.text();
      try {
        return JSON.parse(raw) as SecFetchResult<T, M>;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`SEC JSON parse failed: ${message} | ${raw.slice(0, 200)}`);
      }
    }
    default:
      return (await response.text()) as SecFetchResult<T, M>;
  }
}

function normalizeMode(mode: SecFetchMode): SecFetchMode {
  return mode === SecFetchMode.HTM ? SecFetchMode.HTML : mode;
}

export async function fetchSecPageWithRetry<
  T = string,
  M extends SecFetchMode = SecFetchMode.TEXT,
>(
  url: string,
  mode: M = SecFetchMode.TEXT as M,
): Promise<SecFetchResult<T, M>> {
  const maxBackoffMs = Number.isFinite(SEC_REQUEST_MAX_BACKOFF_MS)
    ? Math.max(SEC_REQUEST_DELAY_MS, Math.floor(SEC_REQUEST_MAX_BACKOFF_MS))
    : 15000;

  const resolvedMode = normalizeMode(mode);
  const requestMode =
    resolvedMode === SecFetchMode.JSON || resolvedMode === SecFetchMode.PDF
      ? resolvedMode
      : (SecFetchMode.TEXT as SecTextMode);
  const headers = buildSecHeaders(requestMode);

  for (let attempt = 0; attempt < SEC_REQUEST_MAX_RETRIES; attempt++) {
    await new Promise((r) => setTimeout(r, SEC_REQUEST_DELAY_MS));

    let retryAfterMs: number | undefined;
    try {
      const response = await fetch(url, { headers });

      if (response.ok) {
        return await parseSecResponse<T, M>(response, resolvedMode as M);
      }

      const body = await response.text();
      retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      logger.warn("SEC fetch failed", {
        url,
        status: response.status,
        statusText: response.statusText,
        attempt: attempt + 1,
        maxRetries: SEC_REQUEST_MAX_RETRIES,
        retryAfterMs,
      });

      const retryable = isRetryableStatus(response.status);
      if (!retryable || attempt === SEC_REQUEST_MAX_RETRIES - 1) {
        throw new SecFetchError(
          response.status,
          response.statusText,
          body.slice(0, 200),
        );
      }
    } catch (err) {
      if (err instanceof SecFetchError) {
        const retryable = isRetryableStatus(err.status);
        if (!retryable || attempt === SEC_REQUEST_MAX_RETRIES - 1) {
          throw err;
        }
      } else if (attempt === SEC_REQUEST_MAX_RETRIES - 1) {
        throw err;
      }
    }

    const exponentialBackoff =
      SEC_REQUEST_DELAY_MS * 2 ** attempt +
      Math.random() * SEC_REQUEST_DELAY_MS;
    const backoff = Math.min(
      Math.max(exponentialBackoff, retryAfterMs ?? 0),
      maxBackoffMs,
    );
    await new Promise((r) => setTimeout(r, backoff));
  }

  throw new Error("Unreachable");
}
