import fs from "fs/promises";
import path from "path";
import { upsertCompany } from "../db/repo";
import { logger } from "../utils/logger";

/**
 * Creates "Missing" Companies from Filings.
 *
 * NOTE: This script primarily handles "Issuers". These are companies that are required
 * to report 10-K/20-F publicly to the SEC (e.g. Debt Issuers, OTC, Funds), but might
 * not be "Public" in the sense of being traded on a major exchange (NYSE/NASDAQ).
 * They often lack tickers but have CIKs and file headers.
 */

const UNKNOWNS_FILE = path.resolve(
  __dirname,
  "../data_source/sec/output/fillings_unknown_ciks.json"
);

async function main() {
  logger.info("🚀 Creating Missing Companies from Unknown Filings log...");

  if (
    !(await fs
      .stat(UNKNOWNS_FILE)
      .then(() => true)
      .catch(() => false))
  ) {
    logger.error(`File not found: ${UNKNOWNS_FILE}`);
    return;
  }

  const raw = await fs.readFile(UNKNOWNS_FILE, "utf-8");
  const unknowns = JSON.parse(raw); // Array of { cik, registrant_name, ... }

  logger.info(`Found ${unknowns.length} unknown entries.`);

  // Deduplicate by CIK
  const uniqueCompanies = new Map<string, string>(); // CIK -> Name
  for (const row of unknowns) {
    if (row.cik && row.registrant_name) {
      uniqueCompanies.set(row.cik, row.registrant_name);
    }
  }

  logger.info(`Identified ${uniqueCompanies.size} unique missing companies.`);

  let processed = 0;
  const errors: any[] = [];

  for (const [cik, name] of uniqueCompanies) {
    try {
      await upsertCompany({
        name: name,
        type: "issuer", // These are SEC issuers (file 10-K/20-F) but not in ticker data
        identity: {
          cik: [cik], // CIK is now an array
        },
      });
    } catch (e) {
      errors.push({ cik, error: e });
      logger.error(`Failed to create company ${cik}`, { error: e });
    }

    processed++;
    if (processed % 100 === 0) {
      logger.info(`Created ${processed}/${uniqueCompanies.size} companies...`);
    }
  }

  logger.info("✅ Finished creating missing companies.");
  if (errors.length > 0) {
    logger.warn(`Failed to create ${errors.length} companies.`);
  }
}

main().catch((error) => {
  logger.error("Fatal error during company creation", { 
    error: error.message,
    stack: error.stack 
  });
  process.exit(1);
});
