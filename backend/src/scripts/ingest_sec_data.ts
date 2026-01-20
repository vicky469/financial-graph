import fs from "fs";
import path from "path";
import { db } from "../db/client";
import {
  upsertCompany,
  upsertCompanyInfo,
  getCompanyIdByCik,
} from "../db/repo/companies";
import { CompanyType } from "@financial-graph/shared";

// Parameters
const CSV_PATH = path.resolve(
  __dirname,
  "../data_source/sec/output/company_tickers.csv",
);
const SUBMISSIONS_DIR = "/Users/wenqingli/Downloads/submissions";

async function main() {
  console.log("Starting SEC data ingestion...");

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found at: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.split("\n");

  // Skip header if exists (checking simple heuristic)
  const startIndex = lines[0].includes("cik") ? 1 : 0;

  // Track stats
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    //CIK is the first number.
    const parts = line.split(",");
    let cikRaw = parts[0];

    // Check if parts[0] is numeric.
    if (!/^\d+$/.test(cikRaw)) {
      // Try other parts
      const numericPart = parts.find((p) => /^\d+$/.test(p));
      if (numericPart) cikRaw = numericPart;
      else {
        // Check quotes
        const cleanParts = parts.map((p) => p.replace(/"/g, "").trim());
        const numericPartClean = cleanParts.find((p) => /^\d+$/.test(p));
        if (numericPartClean) cikRaw = numericPartClean;
        else {
          console.warn(`Skipping line: ${line} (No CIK found)`);
          continue;
        }
      }
    }

    const cik = cikRaw.padStart(10, "0");
    const jsonPath = path.join(SUBMISSIONS_DIR, `CIK${cik}.json`);

    if (!fs.existsSync(jsonPath)) {
      if (processed < 5)
        console.log(`JSON not found for CIK ${cik} at ${jsonPath}`);
      skipped++;
      continue;
    }

    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      await processCompany(cik, jsonData);
      processed++;
      if (processed >= 1) break; // Verification limit
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
  const newIdentity = {
    ...oldIdentity,
    primaryCIK: cik, // Ensure CIK is correct
    // Append fields if not null/empty
    tickers: data.tickers
      ? Array.isArray(data.tickers)
        ? data.tickers[0]
        : data.tickers
      : oldIdentity.tickers, // Take first ticker? API returns array.
    exchanges: data.exchanges
      ? Array.isArray(data.exchanges)
        ? data.exchanges[0]
        : data.exchanges
      : oldIdentity.exchanges,
    entityType: data.entityType || oldIdentity.entityType,
    sic: data.sic || oldIdentity.sic,
    sicDescription: data.sicDescription || oldIdentity.sicDescription,
    ein: data.ein || oldIdentity.ein,
    lei: data.lei || oldIdentity.lei,
    category: data.category || oldIdentity.category,
  };

  // Handling arrays for tickers/exchanges slightly better: join string?
  // Schema says string. "QQQ", "Nasdaq".
  if (Array.isArray(data.tickers) && data.tickers.length > 0)
    newIdentity.tickers = data.tickers[0];
  if (Array.isArray(data.exchanges) && data.exchanges.length > 0)
    newIdentity.exchanges = data.exchanges[0];

  // 3. Upsert Company (Updates identity and jurisdiction)
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
  const addresses = {
    mailing: data.addresses?.mailing,
    business: data.addresses?.business,
  };

  await upsertCompanyInfo(companyId, {
    fiscal_year_end: data.fiscalYearEnd,
    addresses: addresses,
    phone: data.phone,
    former_names: data.formerNames,
  });
}

// Check if running directly
if (require.main === module) {
  main().catch(console.error);
}
