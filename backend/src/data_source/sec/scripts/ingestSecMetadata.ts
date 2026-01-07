import fs from "node:fs/promises";
import path from "node:path";
import {
  SEC_OUTPUT_DIR,
  SEC_QUARTERS,
  SEC_RAW_DIR,
  SEC_YEARS,
} from "../config";
import { logger } from "../../utils/logger";

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

const HEADER_SEPARATOR_REGEX: RegExp = /^-{3,}$/;

async function main(): Promise<void> {
  logger.info("Starting SEC metadata ingestion", {
    years: SEC_YEARS,
    quarters: SEC_QUARTERS,
  });

  await fs.mkdir(SEC_OUTPUT_DIR, { recursive: true });

  const results: RegistrantEntry[] = [];

  // Parse all quarterly body files
  for (const year of SEC_YEARS) {
    for (const quarter of SEC_QUARTERS) {
      const bodyPath: string = path.join(
        SEC_RAW_DIR,
        `${year}-Q${quarter}.body`
      );

      let text: string;
      try {
        text = await fs.readFile(bodyPath, "utf-8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          logger.warn("Missing raw SEC index file", {
            bodyPath,
            year,
            quarter,
          });
          continue;
        }
        throw error;
      }

      const entries: RegistrantEntry[] = parseBodyFile(text, year, quarter);
      logger.info("Parsed SEC quarterly index", {
        year,
        quarter,
        entriesFound: entries.length,
      });

      // Avoid stack overflow with large arrays - concat instead of spread
      for (const entry of entries) {
        results.push(entry);
      }
    }
  }

  logger.info("Completed parsing all quarters", {
    totalEntries: results.length,
  });

  // Deduplicate by CIK + accession number
  const deduped: Map<string, RegistrantEntry> = new Map<
    string,
    RegistrantEntry
  >();
  const duplicates: RegistrantEntry[] = [];

  for (const entry of results) {
    const key: string = `${entry.cik}-${entry.accessionNumberNoDashes}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    } else {
      duplicates.push(entry);
    }
  }

  if (duplicates.length > 0) {
    await writeCsvOutput(duplicates, "duplicates");
    logger.warn(
      `Found ${duplicates.length} duplicate entries. Saved to duplicates CSV.`
    );
  }

  logger.info("Deduplicated entries", {
    beforeDedup: results.length,
    afterDedup: deduped.size,
    duplicatesRemoved: results.length - deduped.size,
  });

  if (deduped.size === 0) {
    logger.warn("No SEC rows parsed. Keeping existing CSV contents.");
    return;
  }

  await writeCsvOutput(Array.from(deduped.values()));
}

/**
 * Write registrant entries to CSV file
 */
async function writeCsvOutput(
  entries: RegistrantEntry[],
  suffix?: string
): Promise<void> {
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
  for (const entry of entries) {
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

  const minYear = Math.min(...SEC_YEARS);
  const maxYear = Math.max(...SEC_YEARS);
  const yearsLabel = Number.isFinite(minYear)
    ? minYear === maxYear
      ? `${minYear}`
      : `${minYear}-${maxYear}`
    : "unknown";
  const outputFile = path.join(
    SEC_OUTPUT_DIR,
    suffix
      ? `registrant_metadata_${yearsLabel}_${suffix}.csv`
      : `registrant_metadata_${yearsLabel}.csv`
  );
  await fs.writeFile(outputFile, lines.join("\n") + "\n", "utf-8");
  logger.info("Successfully wrote SEC metadata CSV", {
    outputFile,
    rowCount: entries.length,
    yearsLabel,
  });
}

/**
 * Process a single line from the SEC master index file
 * Returns a RegistrantEntry if the line is valid, null otherwise
 */
function processLine(
  line: string,
  sourceQuarter: string
): RegistrantEntry | null {
  // Skip empty lines
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Split on 2+ spaces to separate columns
  const columns = trimmed.split(/\s{2,}/);
  if (columns.length < 5) {
    logger.error("Skipping malformed line (expected ≥5 columns)", {
      line: trimmed,
      columnCount: columns.length,
      sourceQuarter,
    });
    return null;
  }

  const companyName = columns[0];
  const formType = columns[1];
  const cik = columns[2];
  const dateFiled = columns[3];
  const filePath = columns[4];

  // Validate all required fields exist
  if (!companyName || !formType || !cik || !dateFiled || !filePath) return null;

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFiled)) return null;

  // Validate file path contains edgar
  if (!filePath.includes("edgar/")) return null;

  // Extract accession number from file path
  // Example: edgar/data/107136/0001214659-25-002647.txt -> 0001214659-25-002647
  const fileName = filePath.split("/").pop() ?? "";
  const accessionNumber = fileName.replace(/\.[^.]+$/, "");
  const accessionNumberNoDashes = accessionNumber.replace(/-/g, "");

  return {
    registrantName: companyName.trim(),
    cik: cik.trim(),
    accessionNumber,
    accessionNumberNoDashes,
    formType: formType.trim(),
    filingDate: dateFiled.trim(),
    fileName,
    filePath,
    sourceQuarter,
  };
}

/**
 * Parse SEC master index body file
 * Format: Fixed-width columns separated by 2+ spaces
 * Columns: Company Name | Form Type | CIK | Date Filed | File Name
 */
function parseBodyFile(
  content: string,
  year: number,
  quarter: number
): RegistrantEntry[] {
  const lines = content.split(/\r?\n/);
  const sourceQuarter = `${year}-Q${quarter}`;
  const entries: RegistrantEntry[] = [];

  let inDataSection = false;

  for (const line of lines) {
    // Skip until we find the header separator line (dashes)
    if (!inDataSection) {
      if (HEADER_SEPARATOR_REGEX.test(line.trim())) {
        inDataSection = true;
      }
      continue;
    }

    const entry = processLine(line, sourceQuarter);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

main().catch((err) => {
  logger.error("Failed to ingest SEC metadata", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});
