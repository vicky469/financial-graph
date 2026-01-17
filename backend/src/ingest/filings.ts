import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";
import readline from "readline";
import { FinancialGraphRepository } from "../db/repo";
import { createLogger } from "../utils/logger";
import { loadCikLookupCache } from "../db/queries";

const logger = createLogger("ingest/filings");

const REPO = new FinancialGraphRepository();

const INPUT_CSV = path.resolve(
  __dirname,
  "../data_source/sec/output/registrant_metadata_2025.csv"
);
const UNKNOWN_CIKS_FILE = path.resolve(
  __dirname,
  "../data_source/sec/output/fillings_unknown_ciks.json"
);

const TARGET_FORMS = new Set(["10-K", "20-F"]);
const BATCH_SIZE = 500; // Batch database operations


async function main() {
  logger.info("Starting Filing Ingestion...", { input: INPUT_CSV });

  // Load CIK to Company ID mapping (builds from DB if not cached)
  const cikToCompanyId = await loadCikLookupCache();
  const unknownCiks: any[] = [];
  let processed = 0;
  let skippedType = 0;
  let skippedCik = 0;
  let ingested = 0;

  const fileStream = createReadStream(INPUT_CSV);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const headers: string[] = [];
  const batch: any[] = [];

  for await (const line of rl) {
    if (headers.length === 0) {
      headers.push(...line.split(","));
      continue;
    }

    const rowValues = parseCsvLine(line);
    const row: any = {};
    headers.forEach((h, i) => {
      row[h] = rowValues[i];
    });

    processed++;

    // 1. Filter Form Type
    if (!TARGET_FORMS.has(row.form_type)) {
      skippedType++;
      continue;
    }

    // 2. Filter CIK
    const cik = String(row.cik).padStart(10, "0");
    const companyId = cikToCompanyId.get(cik);
    if (!companyId) {
      skippedCik++;
      unknownCiks.push({
        cik,
        form_type: row.form_type,
        filing_date: row.filing_date,
        registrant_name: row.registrant_name,
      });
      continue;
    }

    // 3. Parse source quarter
    const sourceQuarterStr = row.source_quarter;
    const match = sourceQuarterStr.match(/(\d{4})(?:-Q|q)(\d+)/i);
    if (!match) {
      logger.error(`Invalid source_quarter format: ${sourceQuarterStr} for ${row.accession_number}`);
      skippedType++;
      continue;
    }
    const sourceYear = parseInt(match[1]);
    const sourceQuarter = parseInt(match[2]);

    // Add to batch
    batch.push({
      company_id: companyId,
      accession_number: row.accession_number,
      accession_number_nodashes: row.accession_number_nodashes,
      form_type: row.form_type,
      filing_date: new Date(row.filing_date).toISOString(),
      file_name: row.file_name,
      file_url: `https://www.sec.gov/Archives/${row.file_path}`,
      source_quarter: sourceQuarter,
      source_year: sourceYear,
      fiscal_year: null,
      fiscal_quarter: null,
    });

    // Process batch when full
    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      ingested += batch.length;
      batch.length = 0; // Clear batch
      logger.info(`Processed ${processed} rows, ingested ${ingested}...`);
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    await processBatch(batch);
    ingested += batch.length;
  }

  // Write unknowns
  if (unknownCiks.length > 0) {
    logger.warn(
      `Found ${unknownCiks.length} filings for unknown CIKs. Saving to error file: ${UNKNOWN_CIKS_FILE}`
    );
    await fs.writeFile(UNKNOWN_CIKS_FILE, JSON.stringify(unknownCiks, null, 2));
  }

  logger.info("Ingestion Complete", {
    processed,
    ingested,
    skippedType,
    skippedCik,
    unknownCiks: unknownCiks.length,
  });
}

async function processBatch(batch: any[]) {
  try {
    const transactions = batch.map((filing) => REPO.upsertFiling(filing));
    await Promise.all(transactions);
  } catch (e) {
    logger.error(`Failed to process batch`, { error: e });
    // Fallback: try one by one
    for (const filing of batch) {
      try {
        await REPO.upsertFiling(filing);
      } catch (err) {
        logger.error(`Failed to ingest filing ${filing.accession_number}`, { error: err });
      }
    }
  }
}

// Helper for CSV parsing with quotes
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let start = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      let field = line.substring(start, i);
      if (field.startsWith('"') && field.endsWith('"')) {
        field = field.slice(1, -1).replace(/""/g, '"');
      }
      result.push(field);
      start = i + 1;
    }
  }
  // Last field
  let field = line.substring(start);
  if (field.startsWith('"') && field.endsWith('"')) {
    field = field.slice(1, -1).replace(/""/g, '"');
  }
  result.push(field);

  return result;
}

main().catch((error) => {
  logger.error("Fatal error during filing ingestion", { 
    error: error.message,
    stack: error.stack 
  });
  process.exit(1);
});
