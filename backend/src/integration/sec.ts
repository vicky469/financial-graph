import { SEC_USER_AGENT } from "../config/config";

export function buildSecHeaders(): Headers {
  return new Headers({
    "User-Agent": SEC_USER_AGENT,
    "Accept-Encoding": "gzip, deflate",
    Accept: "application/json",
  });
}

export async function fetchSecJSON<T>(url: string): Promise<T> {
  const headers = buildSecHeaders();
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
