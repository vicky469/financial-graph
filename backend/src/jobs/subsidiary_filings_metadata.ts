// Job: Load subsidiary-relevant filing metadata (10-K/20-F family) from
// SEC registrant index JSON files into the DB so EX-21/EX-8 attachment
// workers (ex21/ex8) have candidates to process.
import fs from "node:fs/promises";
import path from "node:path";
import { INDEX_DIR, SEC_QUARTERS } from "../config/config";
import { createLogger } from "../utils/logger";
import {
  loadPublicCompaniesLookup,
  lookupCompanyIdByCik,
} from "../db/queries/company-lookup";
import { createJobConfig, finalizeJobConfig } from "../config/jobConfig";
import { AcceptableYear, RegistrantGrouped, RegistrantIndexFile } from "./type";
import { parseCliYears, parseCliQuarters } from "../utils/cli";
import { WORKLOAD_PRESETS } from "../utils/workload-config";
import { upsertFiling } from "../db/repo";

const logger = createLogger("jobs/subsidiary_filings_metadata");

type FilingRecord = {
  accession_number: string;
  company_id: string;
  form_type: string;
  filing_date: string;
  file_name: string;
  file_url: string;
  source_quarter: number;
  source_year: number;
};

function isSubsidiaryForm(formType?: string): boolean {
  if (!formType) return false;
  const normalized = formType.toUpperCase();
  return normalized.startsWith("10-K") || normalized.startsWith("20-F");
}

// Step 1: load quarter JSON file
async function readQuarterFile(
  year: AcceptableYear,
  quarter: number,
): Promise<RegistrantGrouped[]> {
  const filePath = path.join(
    INDEX_DIR,
    `sec_registrant_index-${year}`,
    `${year}-Q${quarter}.json`,
  );
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as RegistrantIndexFile;
  if (!Array.isArray(parsed.data)) {
    throw new Error(`Invalid registrant index structure in ${filePath}`);
  }
  return parsed.data;
}

// Step 2: transform registrant entries into FilingRecord candidates
function collectFilings(
  registrants: RegistrantGrouped[],
  year: number,
  quarter: number,
  seenAccessions: Map<string, Set<string>>,
  missingCiks: Set<string>,
): FilingRecord[] {
  const filings: FilingRecord[] = [];

  for (const registrant of registrants) {
    for (const filing of registrant.filings ?? []) {
      const formType = filing.formType?.trim();
      if (!isSubsidiaryForm(formType)) continue;

      const accession = filing.accessionNumber?.trim();
      if (!accession) continue;

      const companyId = lookupCompanyIdByCik(filing.cik);
      if (!companyId) {
        missingCiks.add(filing.cik.padStart(10, "0"));
        continue;
      }

      const companiesForAccession =
        seenAccessions.get(accession) ?? new Set<string>();
      if (companiesForAccession.has(companyId)) {
        continue; // already queued this accession-company pair
      }

      filings.push({
        accession_number: accession,
        company_id: companyId,
        form_type: formType,
        // Keep SEC-provided date string as-is (avoid UTC shifting)
        filing_date: filing.filingDate,
        file_name: filing.fileName,
        file_url: `https://www.sec.gov/Archives/${filing.filePath}`,
        source_quarter: quarter,
        source_year: year,
      });

      companiesForAccession.add(companyId);
      seenAccessions.set(accession, companiesForAccession);
    }
  }

  return filings;
}

// Step 3: write filings to DB in batches (faster, avoids per-record queries)
async function ingestFilings(
  records: FilingRecord[],
): Promise<{ success: number; failed: number }> {
  const workload = WORKLOAD_PRESETS.fastIO(records.length);
  const BATCH_SIZE = workload.batchSize;

  logger.info("Starting DB ingestion", {
    records: records.length,
    batchSize: BATCH_SIZE,
  });
  logger.debug(`Workload reasoning: ${workload.reasoning}`);

  let success = 0;
  let failed = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try {
      await Promise.all(
        batch.map((record) =>
          upsertFiling({
            company_id: record.company_id,
            accession_number: record.accession_number,
            form_type: record.form_type,
            filing_date: record.filing_date,
            file_url: record.file_url,
            source_quarter: record.source_quarter,
            source_year: record.source_year,
            file_name: record.file_name,
          }),
        ),
      );
      success += batch.length;
      if (success % 500 === 0 || i + batch.length >= records.length) {
        logger.info("Progress ingesting filings", {
          success,
          total: records.length,
        });
      }
    } catch (error) {
      failed += batch.length;
      logger.error("Failed batch ingest", {
        start: i,
        size: batch.length,
        error: (error as Error).message,
      });
    }
  }

  return { success, failed };
}

// Compose steps for a single year
async function collectYear(
  year: number,
  quarters: number[],
): Promise<{ filings: FilingRecord[]; missingCiks: Set<string> }> {
  const seenAccessions = new Map<string, Set<string>>();
  const missingCiks = new Set<string>();
  const collected: FilingRecord[] = [];

  for (const quarter of quarters) {
    const registrants = await readQuarterFile(year, quarter);
    const filings = collectFilings(
      registrants,
      year,
      quarter,
      seenAccessions,
      missingCiks,
    );
    collected.push(...filings);
    logger.info("Loaded quarter filings", {
      year,
      quarter,
      added: filings.length,
      totalCollected: collected.length,
    });
  }

  return { filings: collected, missingCiks };
}

async function main() {
  try {
    const years = parseCliYears(process.argv[2]);
    const quarterArg = process.argv.slice(3).join(",");
    const selectedQuarters = quarterArg
      ? parseCliQuarters(quarterArg)
      : [...SEC_QUARTERS];
    const cache = await loadPublicCompaniesLookup();
    logger.info("Loaded PUBLIC CIK lookup cache", {
      size: cache.size,
      years,
      quarters: selectedQuarters,
    });

    for (const year of years) {
      const job = createJobConfig(
        `subsidiary_filings_metadata_${year}`,
        "data",
        `subsidiary_filings_metadata-${year}`,
        { year },
      );

      let filings: FilingRecord[] = [];
      let missingCiks: Set<string> = new Set();

      try {
        ({ filings, missingCiks } = await collectYear(year, selectedQuarters));
      } catch (error) {
        logger.error("Failed to load registrant index for year", {
          year,
          error: (error as Error).message,
        });
        throw error;
      }

      if (missingCiks.size > 0) {
        logger.warn("CIKs missing from DB (examples)", {
          year,
          count: missingCiks.size,
          samples: Array.from(missingCiks).slice(0, 10),
        });
      }

      const { success, failed } = await ingestFilings(filings);
      const jobResult = finalizeJobConfig(
        job,
        failed === 0 ? "success" : "failed",
      );

      logger.info("Subsidiary filings metadata job complete", {
        year,
        success,
        failed,
        missingCiks: missingCiks.size,
        job: jobResult,
      });

      if (failed > 0) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Job failed", { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
