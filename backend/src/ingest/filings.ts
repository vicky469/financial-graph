import fs from "fs/promises";
import path from "path";
import { createReadStream } from "fs";
import readline from "readline";
import { FinancialGraphRepository } from "../db/repo";
import { createLogger } from "../utils/logger";

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

import { db } from "../db/client";

async function loadKnownCiks(): Promise<Set<string>> {
  logger.info("Loading known CIKs from Database...");

  const res = await db.query({
    companies: {
      $: {
        where: { type: { $in: ["public", "issuer"] } }, // Filter for public and issuers
        fields: ["identity"], // Only need identity
      },
    },
  });

  const ciks = new Set<string>();

  if (res.companies) {
    for (const comp of res.companies) {
      if (comp.identity && comp.identity.cik) {
        ciks.add(comp.identity.cik);
      }
    }
  }

  logger.info(`Loaded ${ciks.size} known CIKs from DB.`);
  return ciks;
}

async function main() {
  logger.info("Starting Filing Ingestion...", { input: INPUT_CSV });

  const knownCiks = await loadKnownCiks();
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

  for await (const line of rl) {
    if (headers.length === 0) {
      headers.push(...line.split(","));
      continue;
    }

    // Simple CSV split (assuming no commas in values for relevant columns or simplistic parsing)
    // Note: The previous script does csvEscape, so we might have quotes.
    // For robust parsing, we should implement a proper CSV parser or use library.
    // Given the simplicity and controlled input, strict regex split might work.
    // The previous script wrapped values in quotes if they had commas.
    // Let's use a regex to split properly.
    const rowValues = parseCsvLine(line);

    // Map to object
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
    // Input CIK might not be padded.
    const cik = String(row.cik).padStart(10, "0");

    if (!knownCiks.has(cik)) {
      skippedCik++;
      unknownCiks.push({
        cik,
        form_type: row.form_type,
        filing_date: row.filing_date,
        registrant_name: row.registrant_name,
      });
      continue;
    }

    // 3. Upsert

    try {
      await REPO.upsertFiling({
        company_id: await REPO.getCompanyIdByCik(cik),
        accession_number: row.accession_number,
        accession_number_nodashes: row.accession_number_nodashes,
        form_type: row.form_type,
        filing_date: new Date(row.filing_date).toISOString(),
        file_name: row.file_name,
        file_url: `https://www.sec.gov/Archives/${row.file_path}`,
        source_quarter: row.source_quarter,
        fiscal_year: null, // Don't infer; wait for XBRL parsing
        fiscal_quarter: null, // Don't infer; wait for XBRL parsing
      });

      ingested++;
    } catch (e) {
      // Log errors but continue. If "record-not-unique" happens, it might mean InstantDB
      // is rejecting an overwrite. We log it to diagnose.
      logger.error(`Failed to ingest filing ${row.accession_number}`, {
        error: e,
      });
    }

    if (processed % 1000 === 0) {
      logger.info(`Processed ${processed} rows...`);
    }
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

// function inferFiscalYear(filingDate: string, quarter: string): number {
//   // Crude approximation removed to prevent bad data.
//   return 0;
// }

main().catch(console.error);
