// Job: Download SEC quarterly registrant index files, parse filing rows by CIK,
// group them with aliases/form types, and emit normalized JSON (plus raw bodies)
// under INDEX_DIR for downstream ingestion; years are provided via CLI args.
import fs from "node:fs/promises";
import path from "node:path";
import {
  INDEX_DIR,
  SEC_QUARTERS,
  SEC_REQUEST_DELAY_MS,
  SEC_REQUEST_MAX_RETRIES,
} from "../config/config";
import { fetchSecText } from "../integration/sec";
import { createLogger } from "../utils/logger";
import { writeJsonWithMeta } from "../utils/fs";
import { createJobConfig, finalizeJobConfig } from "../config/jobConfig";
import {
  AcceptableYear,
  RegistrantEntry,
  RegistrantGrouped,
} from "./type";
import { parseCliYears } from "../utils/cli";

const logger = createLogger("jobs/registrant_filing_index");

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQuarter(
  year: AcceptableYear,
  quarter: number,
): Promise<{
  body: string;
  rawPath: string;
  baseDir: string;
}> {
  const url = `https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${quarter}/company.idx`;
  const baseDir = path.join(INDEX_DIR, `sec_registrant_index-${year}`);
  const rawPath = path.join(baseDir, `${year}-Q${quarter}.body`);
  for (let attempt = 1; attempt <= SEC_REQUEST_MAX_RETRIES; attempt += 1) {
    try {
      await delay(SEC_REQUEST_DELAY_MS);
      const text = await fetchSecText(url);
      logger.info(`Fetched ${year}-Q${quarter} index`);
      await fs.mkdir(baseDir, { recursive: true });
      await fs.writeFile(rawPath, text, "utf-8");
      logger.info(`Saved raw body ${year}-Q${quarter}`);
      return { body: text, rawPath, baseDir };
    } catch (err) {
      const isLast = attempt === SEC_REQUEST_MAX_RETRIES;
      logger.warn("Fetch attempt failed", {
        year,
        quarter,
        attempt,
        error: (err as Error).message,
      });
      if (isLast) throw err;
      await delay(SEC_REQUEST_DELAY_MS * attempt);
    }
  }
  throw new Error("Unreachable");
}

function processLine(line: string): RegistrantEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const columns = trimmed.split(/\s{2,}/);
  if (columns.length < 5) return null;

  const companyName = columns[0];
  const formType = columns[1];
  const cik = columns[2];
  const dateFiled = columns[3];
  const filePath = columns[4];

  if (!companyName || !formType || !cik || !dateFiled || !filePath) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFiled)) return null;
  if (!filePath.includes("edgar/")) return null;

  const fileName = filePath.split("/").pop() ?? "";
  const accessionNumber = fileName.replace(/\.[^.]+$/, "");
  const accessionNumberNoDashes = accessionNumber.replace(/-/g, "");

  return {
    registrantName: companyName.trim(),
    cik: cik.trim().padStart(10, "0"),
    accessionNumber,
    accessionNumberNoDashes,
    formType: formType.trim(),
    filingDate: dateFiled.trim(),
    fileName,
    filePath,
  };
}

function parseBodyFile(content: string): RegistrantEntry[] {
  const lines = content.split(/\r?\n/);
  const entries: RegistrantEntry[] = [];
  const HEADER_SEPARATOR_REGEX = /^-{3,}$/;
  let inDataSection = false;

  for (const line of lines) {
    if (!inDataSection) {
      if (HEADER_SEPARATOR_REGEX.test(line.trim())) {
        inDataSection = true;
      }
      continue;
    }

    const entry = processLine(line);
    if (entry) entries.push(entry);
  }

  return entries;
}

async function writeQuarterIndex(
  entries: RegistrantEntry[],
  year: number,
  quarter: number,
  baseDir: string,
) {
  logger.info(`Parsed ${year}-Q${quarter}: ${entries.length} filings`);

  const grouped = new Map<string, RegistrantGrouped>();
  const aliasSets = new Map<string, Set<string>>();
  const formTypesSet = new Set<string>();

  for (const entry of entries) {
    formTypesSet.add(entry.formType);
    const existing = grouped.get(entry.cik);
    if (!existing) {
      grouped.set(entry.cik, {
        cik: entry.cik,
        name: entry.registrantName,
        filings: [entry],
        formTypes: [entry.formType],
        aliases: [],
      });
      aliasSets.set(entry.cik, new Set<string>());
      continue;
    }

    if (existing.name !== entry.registrantName) {
      const set = aliasSets.get(entry.cik) ?? new Set<string>();
      set.add(entry.registrantName);
      aliasSets.set(entry.cik, set);
    }

    existing.filings.push(entry);
    if (!existing.formTypes.includes(entry.formType)) {
      existing.formTypes.push(entry.formType);
    }
  }

  const registrants = Array.from(grouped.values()).map((r) => {
    const aliases = Array.from(aliasSets.get(r.cik) ?? []);
    return {
      ...r,
      aliases,
      formTypes: r.formTypes.sort(),
      filings: r.filings.sort((a, b) =>
        a.filingDate.localeCompare(b.filingDate),
      ),
    };
  });

  const notes = {
    uniqueFormTypes: Array.from(formTypesSet).sort(),
    uniqueFormTypeCount: formTypesSet.size,
    uniqueRegistrants: registrants.length,
  };

  const outputFile = path.join(baseDir, `${year}-Q${quarter}.json`);
  const sourceUrl = `https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${quarter}/company.idx`;

  const jobConfig = createJobConfig(
    `sec_registrant_index_${year}_Q${quarter}`,
    "index",
    sourceUrl,
    { year, quarter },
  );

  const { meta } = await writeJsonWithMeta({
    filePath: outputFile,
    source: jobConfig.sourceUrl,
    data: registrants,
    notes: { job: finalizeJobConfig(jobConfig, "success"), ...notes },
  });

  logger.info("Wrote registrant filing index", {
    output: outputFile,
    registrants: registrants.length,
    filings: meta.records,
    year,
    quarter,
    fileSize: meta.fileSize,
  });
}

async function main() {
  try {
    const years = parseCliYears(process.argv[2]);

    for (const year of years) {
      for (const quarter of SEC_QUARTERS) {
        const { body, baseDir } = await fetchQuarter(year, quarter);
        const entries = parseBodyFile(body);
        await writeQuarterIndex(entries, year, quarter, baseDir);
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Failed to build registrant filing index", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
