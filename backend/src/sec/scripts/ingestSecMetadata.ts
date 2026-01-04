import fs from "node:fs/promises";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv();

const YEARS = [2025];
const QUARTERS = [1, 2, 3, 4] as const;
const METADATA_DIR = path.resolve(__dirname, "../output");
const RAW_DIR = path.resolve(__dirname, "../raw");
const OUTPUT_FILE = path.join(METADATA_DIR, "registrant_metadata.csv");
const REQUEST_DELAY_MS = Number(process.env.SEC_REQUEST_DELAY_MS ?? 400);

const USER_AGENT = process.env.SEC_USER_AGENT ?? "";
if (!USER_AGENT) {
  throw new Error("Missing SEC_USER_AGENT env variable");
}

interface RegistrantEntry {
  registrantName: string;
  cik: string;
  accessionNumber: string;
  accessionNumberNoDashes: string;
  formType: string;
  filingDate: string;
  fileName: string;
  filePath: string;
  sourceQuarter: string;
}

async function main() {
  await Promise.all([
    fs.mkdir(METADATA_DIR, { recursive: true }),
    fs.mkdir(RAW_DIR, { recursive: true }),
  ]);

  const results: RegistrantEntry[] = [];

  for (const year of YEARS) {
    for (const quarter of QUARTERS) {
      const url = `https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${quarter}/company.idx`;
      console.log(`Fetching ${url}`);
      await delay(REQUEST_DELAY_MS);

      const requestHeaders = {
        "User-Agent": USER_AGENT,
        Accept: "text/plain",
      };

      const response = await fetch(url, {
        headers: new Headers(requestHeaders),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`
        );
      }

      const text = await response.text();
      await persistRawFetch({
        year,
        quarter,
        url,
        requestHeaders,
        response,
        body: text,
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (
        contentType.includes("text/html") &&
        text.includes(
          "Your Request Originates from an Undeclared Automated Tool"
        )
      ) {
        throw new Error(
          `Blocked by SEC automated-tool firewall for ${year} Q${quarter}. Update User-Agent or slow down.`
        );
      }

      const entries = parseCompanyIdx(text, year, quarter);
      results.push(...entries);
    }
  }

  // Deduplicate by CIK + accession
  const deduped = new Map<string, RegistrantEntry>();
  for (const entry of results) {
    const key = `${entry.cik}-${entry.accessionNumberNoDashes}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  const header = [
    "registrant_name",
    "cik",
    "accession_number",
    "accession_number_nodashes",
    "form_type",
    "filing_date",
    "file_name",
    "source_quarter",
    "file_path",
  ];

  const lines = [header.join(",")];
  for (const entry of deduped.values()) {
    lines.push(
      [
        csvEscape(entry.registrantName),
        entry.cik,
        entry.accessionNumber,
        entry.accessionNumberNoDashes,
        entry.formType,
        entry.filingDate,
        csvEscape(entry.fileName),
        entry.sourceQuarter,
        entry.filePath ?? "",
      ].join(",")
    );
  }

  if (deduped.size === 0) {
    console.warn(
      "No SEC rows parsed. Keeping existing CSV contents and stopping early."
    );
    return;
  }

  await fs.writeFile(OUTPUT_FILE, lines.join("\n") + "\n", "utf-8");
  console.log(`Wrote ${deduped.size} rows to ${OUTPUT_FILE}`);
}

function parseCompanyIdx(
  content: string,
  year: number,
  quarter: number
): RegistrantEntry[] {
  const lines = content.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.startsWith("Company Name")
  );
  if (headerIndex === -1) {
    return [];
  }

  const dataLines = lines
    .slice(headerIndex + 1)
    .filter((line) => line.trim().length > 0);
  const entries: RegistrantEntry[] = [];

  for (const rawLine of dataLines) {
    const parts = rawLine.split("|");
    if (parts.length < 5) continue;
    const [registrantName, formType, cik, filingDate, filePath] = parts
      .slice(0, 5)
      .map((p) => p.trim()) as [string, string, string, string, string];
    if (!registrantName || !cik || !filePath) continue;

    const accessionWithExtension = filePath.split("/").pop() ?? "";
    const accessionNumber = accessionWithExtension.replace(/\.[^.]+$/, "");
    const accessionNumberNoDashes = accessionNumber.replace(/-/g, "");
    const fileName = accessionWithExtension;

    entries.push({
      registrantName,
      cik,
      accessionNumber,
      accessionNumberNoDashes,
      formType,
      filingDate,
      fileName,
      filePath,
      sourceQuarter: `${year}-Q${quarter}`,
    });
  }

  return entries;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function persistRawFetch({
  year,
  quarter,
  url,
  requestHeaders,
  response,
  body,
}: {
  year: number;
  quarter: number;
  url: string;
  requestHeaders: Record<string, string>;
  response: Response;
  body: string;
}) {
  const prefix = path.join(RAW_DIR, `${year}-Q${quarter}`);
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
    fs.writeFile(`${prefix}.body`, body, "utf-8"),
  ]);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("Failed to ingest SEC metadata", err);
  process.exit(1);
});
