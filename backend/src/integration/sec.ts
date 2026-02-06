import { SEC_USER_AGENT } from "../config/config";
import { createLogger } from "../utils/logger";

const SEC_REQUEST_MAX_RETRIES = 3;
const SEC_REQUEST_DELAY_MS = 200;

const logger = createLogger("integration/sec");

type AcceptType = "json" | "text" | "html";

function buildSecHeaders(accept?: AcceptType): Headers {
  let acceptHeader: string;
  switch (accept) {
    case "json":
      acceptHeader = "application/json";
      break;
    default:
      // For plain text/htm we accept anything; SEC often returns text/html
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

export async function fetchSecJSON<T>(url: string): Promise<T> {
  const headers = buildSecHeaders("json");
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `SEC fetch failed: ${response.status} ${response.statusText} | ${body.slice(
        0,
        200,
      )}`,
    );
  }

  return (await response.json()) as T;
}

async function fetchSecPage(url: string): Promise<Response> {
  const headers = buildSecHeaders();
  return fetch(url, { headers });
}

export async function fetchSecPageWithRetry(url: string): Promise<string> {
  for (let attempt = 0; attempt < SEC_REQUEST_MAX_RETRIES; attempt++) {
    await new Promise((r) => setTimeout(r, SEC_REQUEST_DELAY_MS));
    try {
      const response = await fetchSecPage(url);

      if (response.ok) {
        return await response.text();
      }

      const body = await response.text();
      logger.warn("SEC fetch failed", {
        url,
        status: response.status,
        statusText: response.statusText,
      });

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === SEC_REQUEST_MAX_RETRIES - 1) {
        throw new SecFetchError(
          response.status,
          response.statusText,
          body.slice(0, 200),
        );
      }
    } catch (err) {
      // Network or other fetch error
      if (attempt === SEC_REQUEST_MAX_RETRIES - 1) throw err;
    }

    const backoff =
      SEC_REQUEST_DELAY_MS * 2 ** attempt +
      Math.random() * SEC_REQUEST_DELAY_MS;
    await new Promise((r) => setTimeout(r, Math.min(backoff, 5000)));
  }

  throw new Error("Unreachable");
}
