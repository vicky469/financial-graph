import { SEC_USER_AGENT } from "../config/config";

type AcceptType = "json" | "text" | "html";

function buildSecHeaders(accept: AcceptType): Headers {
  const acceptHeader =
    accept === "json"
      ? "application/json"
      : accept === "html"
        ? "text/html,*/*"
        : "*/*";

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

export async function fetchSecText(url: string): Promise<string> {
  const headers = buildSecHeaders("text");
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.text();
    throw new SecFetchError(
      response.status,
      response.statusText,
      body.slice(0, 200),
    );
  }

  return await response.text();
}

export async function fetchSecTextWithRetry(
  url: string,
  maxRetries = 3,
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchSecText(url);
    } catch (err) {
      const isSecErr =
        err instanceof SecFetchError &&
        (err.status === 429 || err.status >= 500);
      if (!isSecErr || attempt === maxRetries - 1) throw err;
      const backoff = Math.min(500 * 2 ** attempt + Math.random() * 250, 5000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw new Error("Unreachable");
}
