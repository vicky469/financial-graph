import fs from "node:fs/promises";
import path from "node:path";
import {
  SEC_QUARTERS,
  SEC_RAW_DIR,
  SEC_REQUEST_DELAY_MS,
  SEC_REQUEST_MAX_RETRIES,
  SEC_USER_AGENT,
  SEC_YEARS,
} from "../config";

const REQUEST_HEADERS = {
  "User-Agent": SEC_USER_AGENT,
  Accept: "text/plain",
};

async function main() {
  await fs.mkdir(SEC_RAW_DIR, { recursive: true });

  for (const year of SEC_YEARS) {
    for (const quarter of SEC_QUARTERS) {
      await downloadQuarter(year, quarter);
    }
  }

  console.log("Finished fetching SEC index files");
}

async function downloadQuarter(year: number, quarter: number) {
  const url = `https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${quarter}/company.idx`;
  const prefix = path.join(SEC_RAW_DIR, `${year}-Q${quarter}`);
  console.log(`Fetching ${url}`);

  for (let attempt = 1; attempt <= SEC_REQUEST_MAX_RETRIES; attempt += 1) {
    try {
      const { response, text } = await fetchIndex(url);
      await persistRawFetch({
        prefix,
        url,
        requestHeaders: REQUEST_HEADERS,
        response,
        payload: text,
      });
      console.log(`Saved raw index ${prefix}`);
      return;
    } catch (error) {
      const isLastAttempt = attempt === SEC_REQUEST_MAX_RETRIES;
      const err = error as Error;
      console.warn(
        `Attempt ${attempt} failed for ${url}: ${err.message}${
          isLastAttempt ? "" : " (retrying)"
        }`
      );
      if (isLastAttempt) {
        throw err;
      }
      await delay(SEC_REQUEST_DELAY_MS * attempt);
    }
  }
}

async function fetchIndex(url: string) {
  await delay(SEC_REQUEST_DELAY_MS);
  const response = await fetch(url, {
    headers: new Headers(REQUEST_HEADERS),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType.includes("text/html") &&
    text.includes("Your Request Originates from an Undeclared Automated Tool")
  ) {
    throw new Error(
      `Blocked by SEC automated-tool firewall for ${url}. Update User-Agent or slow down.`
    );
  }

  return { response, text };
}

async function persistRawFetch({
  prefix,
  url,
  requestHeaders,
  response,
  payload,
}: {
  prefix: string;
  url: string;
  requestHeaders: Record<string, string>;
  response: Response;
  payload: string;
}) {
  const metadata = {
    timestamp: new Date().toISOString(),
    url,
    requestHeaders,
    responseStatus: response.status,
    responseStatusText: response.statusText,
    responseHeaders: Object.fromEntries(response.headers.entries()),
  };

  await Promise.all([
    fs.writeFile(
      `${prefix}.meta.json`,
      JSON.stringify(metadata, null, 2),
      "utf-8"
    ),
    fs.writeFile(`${prefix}.body`, payload, "utf-8"),
  ]);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Failed to fetch SEC indexes", err);
  process.exit(1);
});
