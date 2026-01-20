import fs from "fs";
import path from "path";
import { db } from "../db/client";
import {
  upsertCompany,
  upsertCompanyInfo,
  getCompanyIdByCik,
} from "../db/repo/companies";
import { CompanyType } from "@financial-graph/shared";
import { createLogger } from "../utils/logger";
import dotenv from "dotenv";

dotenv.config();

const logger = createLogger("SEC Ingestion");

// Parameters
const CSV_PATH = path.resolve(
  __dirname,
  "../data_source/sec/output/company_tickers.csv",
);
const SUBMISSIONS_DIR = path.join(
  process.env.HOME || "",
  "Downloads/submissions",
);

async function main() {
  logger.info("Starting SEC data ingestion...");

  if (!fs.existsSync(CSV_PATH)) {
    logger.error(`CSV file not found at: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.split("\n");

  // Header: cik,name,ticker,exchange
  const startIndex = 1; // Skip header

  // Track stats
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line: 1045810,NVIDIA CORP,NVDA,Nasdaq
    // Note: Name might contain commas and be quoted.
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!parts || parts.length < 1) continue;

    const cikRaw = parts[0].replace(/,/g, ""); // First column is CIK

    const cik = cikRaw.padStart(10, "0");
    const jsonPath = path.join(SUBMISSIONS_DIR, `CIK${cik}.json`);

    if (!fs.existsSync(jsonPath)) {
      if (processed < 5)
        console.log(`JSON not found for CIK ${cik} at ${jsonPath}`);
      console.log(`JSON not found for CIK ${cik} at ${jsonPath}`);
      skipped++;
      continue;
    }

    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const companyId = await processCompany(cik, jsonData);
      processed++;
      console.log(
        `Successfully processed company CIK: ${cik}, ID: ${companyId}`,
      );
      if (processed % 100 === 0)
        console.log(`Processed ${processed} companies...`);
    } catch (err) {
      console.error(`Error processing CIK ${cik}:`, err);
      errors++;
    }
  }

  console.log(
    `Ingestion complete. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`,
  );
}

async function processCompany(cik: string, data: any) {
  const companyId = getCompanyIdByCik(cik);

  // 1. Fetch existing company to get identity
  const existingResult = await db.query({
    company: {
      $: { where: { id: companyId } },
    },
  });

  const existingCompany = existingResult.company[0];
  const oldIdentity = existingCompany?.identity || {};

  // 2. Prepare merged identity
  // 2. Prepare merged identity
  // Start with old identity to preserve existing flags like sp500
  const newIdentity: any = { ...oldIdentity };

  // Helper to safely update and log missing
  const updateField = (key: string, value: any, sourceName: string) => {
    if (value !== undefined && value !== null && value !== "") {
      newIdentity[key] = value;
    } else if (!newIdentity[key]) {
      // Only log if we don't have it and didn't get it (optional: reduce noise if many missings)
      // logger.debug(`Missing ${key} for CIK ${cik} from ${sourceName}`);
    }
  };

  // Direct mapping fields
  updateField("primaryCIK", cik, "inferred");
  updateField("entityType", data.entityType, "SEC");
  updateField("sic", data.sic, "SEC");
  updateField("sicDescription", data.sicDescription, "SEC");
  updateField("ein", data.ein, "SEC");
  updateField("category", data.category, "SEC");
  updateField("ownerOrg", data.ownerOrg, "SEC");

  // LEI/DUNS
  if (data.lei) newIdentity.lei = data.lei;
  // if (data.duns) newIdentity.duns = data.duns; // Not in SEC usually

  // Arrays
  const ticker = Array.isArray(data.tickers) ? data.tickers[0] : data.tickers;
  if (ticker) newIdentity.tickers = ticker;

  const exchange = Array.isArray(data.exchanges)
    ? data.exchanges[0]
    : data.exchanges;
  if (exchange) newIdentity.exchanges = exchange;

  // Log what we might still be missing for important fields
  const importantFields = ["tickers", "exchanges", "sic", "entityType"];
  const missing = importantFields.filter((f) => !newIdentity[f]);
  if (missing.length > 0) {
    logger.debug(
      `CIK ${cik} missing fields after merge: ${missing.join(", ")}`,
    );
  }

  // Cleanup
  if (newIdentity.lei && newIdentity.lei.length !== 20) delete newIdentity.lei;
  if (newIdentity.duns && newIdentity.duns.length !== 9)
    delete newIdentity.duns;

  const addresses = {
    mailing: data.addresses?.mailing,
    business: data.addresses?.business,
  };

  // 3. Upsert Company (Updates identity and jurisdiction)
  if (process.argv.includes("--dry-run")) {
    logger.info(`[DRY RUN] Would upsert company ${cik}:`, {
      name: data.name,
      identity: newIdentity,
      jurisdiction: data.stateOfIncorporationDescription,
    });
    logger.info(`[DRY RUN] Would upsert info for ${companyId}:`, {
      fiscal_year_end: data.fiscalYearEnd,
      addresses: addresses,
      phone: data.phone,
    });
    return companyId;
  }

  await upsertCompany({
    type: CompanyType.PUBLIC,
    name: data.name || (existingCompany ? existingCompany.name : "Unknown"), // Use SEC name if creating
    identity: newIdentity,
    jurisdiction_raw:
      data.stateOfIncorporationDescription || existingCompany?.jurisdiction_raw,
    // Keep other existing fields
    jurisdiction_iso: existingCompany?.jurisdiction_iso,
    aliases: existingCompany?.aliases,
  });

  // 4. Upsert Company Info
  await upsertCompanyInfo(companyId, {
    fiscal_year_end: data.fiscalYearEnd,
    addresses: addresses,
    phone: data.phone,
    former_names: data.formerNames,
  });

  return companyId;
}

// Check if running directly
if (require.main === module) {
  main().catch(console.error);
}
