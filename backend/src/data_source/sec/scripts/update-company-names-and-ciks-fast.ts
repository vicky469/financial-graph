/**
 * Update Company Names and CIKs from Registrant Metadata (FAST VERSION)
 * 
 * This script processes registrant metadata to:
 * 1. For 1 CIK = Multiple Names: Use latest filing's name as primary, others as aliases
 * 2. For Multiple CIKs = 1 Name: Merge into single company with all CIKs in array
 * 
 * Run: bun src/data_source/sec/scripts/update-company-names-and-ciks-fast.ts
 */

import fs from "fs";
import readline from "readline";
import { join } from "path";
import { db } from "../../../db/client";
import { generateCompanyId } from "../../../db/ids";
import type { Company } from "../../../types";

const DATA_DIR = join(__dirname, "../output");
const REGISTRANT_CSV = join(DATA_DIR, "registrant_metadata_2025.csv");

interface RegistrantRecord {
  registrant_name: string;
  cik: string;
  filing_date: string;
}

interface CikNameGroup {
  cik: string;
  names: Map<string, { lastDate: string }>;
  primaryName: string;
  aliases: string[];
}

interface NameCikGroup {
  name: string;
  ciks: Set<string>;
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
  let field = line.substring(start);
  if (field.startsWith('"') && field.endsWith('"')) {
    field = field.slice(1, -1).replace(/""/g, '"');
  }
  result.push(field);
  return result;
}

async function main() {
  console.log("Loading registrant metadata...");
  
  const cikGroups = new Map<string, CikNameGroup>();
  const fileStream = fs.createReadStream(REGISTRANT_CSV);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let isFirstLine = true;
  let lineCount = 0;

  // Stream and process CSV
  for await (const line of rl) {
    if (isFirstLine) {
      headers = parseCsvLine(line);
      isFirstLine = false;
      continue;
    }

    lineCount++;
    if (lineCount % 100000 === 0) {
      console.log(`  Processed ${lineCount.toLocaleString()} records...`);
    }

    const values = parseCsvLine(line);
    const cikIdx = headers.indexOf("cik");
    const nameIdx = headers.indexOf("registrant_name");
    const dateIdx = headers.indexOf("filing_date");

    const cik = values[cikIdx];
    const registrant_name = values[nameIdx];
    const filing_date = values[dateIdx];

    if (!cikGroups.has(cik)) {
      cikGroups.set(cik, {
        cik,
        names: new Map(),
        primaryName: "",
        aliases: [],
      });
    }

    const group = cikGroups.get(cik)!;
    const nameData = group.names.get(registrant_name);

    if (!nameData || filing_date > nameData.lastDate) {
      group.names.set(registrant_name, { lastDate: filing_date });
    }
  }

  console.log(`Loaded ${lineCount.toLocaleString()} filing records`);

  // Determine primary name (most recent filing) for each CIK
  console.log("\n=== Step 1: Analyzing CIK → Name relationships ===");
  for (const group of cikGroups.values()) {
    let mostRecentDate = "";
    let mostRecentName = "";

    for (const [name, data] of group.names.entries()) {
      if (data.lastDate > mostRecentDate) {
        mostRecentDate = data.lastDate;
        mostRecentName = name;
      }
    }

    group.primaryName = mostRecentName;
    group.aliases = Array.from(group.names.keys()).filter(
      (name) => name !== mostRecentName
    );
  }

  const multipleNamesCount = Array.from(cikGroups.values()).filter(
    (g) => g.names.size > 1
  ).length;

  console.log(`Total CIKs: ${cikGroups.size.toLocaleString()}`);
  console.log(`CIKs with multiple names: ${multipleNamesCount.toLocaleString()}`);

  // Step 2: Group by name to find multiple CIKs per name
  console.log("\n=== Step 2: Analyzing Name → CIK relationships ===");
  const nameGroups = new Map<string, NameCikGroup>();

  for (const group of cikGroups.values()) {
    const name = group.primaryName;
    if (!nameGroups.has(name)) {
      nameGroups.set(name, { name, ciks: new Set() });
    }
    nameGroups.get(name)!.ciks.add(group.cik);
  }

  const multipleCiksCount = Array.from(nameGroups.values()).filter(
    (g) => g.ciks.size > 1
  ).length;

  console.log(`Total unique primary names: ${nameGroups.size.toLocaleString()}`);
  console.log(`Names with multiple CIKs: ${multipleCiksCount.toLocaleString()}`);

  // Step 3: Update company records
  console.log("\n=== Step 3: Updating company records ===");
  console.log("Fetching existing companies...");
  
  const [publicResult, issuerResult] = await Promise.all([
    db.query({ companies: { $: { where: { type: "public" } } } }),
    db.query({ companies: { $: { where: { type: "issuer" } } } }),
  ]);

  const existingCompanies = [
    ...(publicResult.companies || []),
    ...(issuerResult.companies || []),
  ] as Company[];

  console.log(`Found ${existingCompanies.length} existing companies`);

  // Create CIK -> Company map
  const cikToCompanyMap = new Map<string, Company>();
  for (const company of existingCompanies) {
    const ciks = Array.isArray(company.identity?.ciks)
      ? company.identity.cik
      : company.identity?.ciks
      ? [company.identity.cik]
      : [];
    for (const cik of ciks) {
      cikToCompanyMap.set(cik, company);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let merged = 0;

  const nameGroupsArray = Array.from(nameGroups.values());
  const BATCH_SIZE = 100;
  const totalGroups = nameGroupsArray.length;

  console.log(`Processing ${totalGroups.toLocaleString()} companies in batches of ${BATCH_SIZE}...`);

  // Process in batches
  for (let batchIndex = 0; batchIndex < nameGroupsArray.length; batchIndex += BATCH_SIZE) {
    const batch = nameGroupsArray.slice(batchIndex, batchIndex + BATCH_SIZE);
    const batchNum = Math.floor(batchIndex / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalGroups / BATCH_SIZE);
    
    const transactions: any[] = [];

    for (const nameGroup of batch) {
      const { name, ciks } = nameGroup;
      const cikArray = Array.from(ciks).sort();

      // Collect all aliases
      const allAliases = new Set<string>();
      for (const cik of cikArray) {
        const cikGroup = cikGroups.get(cik);
        if (cikGroup) {
          cikGroup.aliases.forEach((alias) => allAliases.add(alias));
        }
      }

      // Check if company exists
      let existingCompany: Company | null = null;
      for (const cik of cikArray) {
        const found = cikToCompanyMap.get(cik);
        if (found) {
          existingCompany = found;
          break;
        }
      }

      if (existingCompany) {
        // Update existing
        const currentCiks = Array.isArray(existingCompany.identity?.ciks)
          ? existingCompany.identity.cik
          : existingCompany.identity?.ciks
          ? [existingCompany.identity.cik]
          : [];
        
        const mergedCiks = Array.from(new Set([...currentCiks, ...cikArray])).sort();
        const currentAliases = existingCompany.aliases || [];
        const mergedAliases = Array.from(
          new Set([...currentAliases, ...Array.from(allAliases)])
        ).filter((alias) => alias !== name);

        const needsUpdate =
          existingCompany.name !== name ||
          JSON.stringify(mergedCiks) !== JSON.stringify(currentCiks) ||
          JSON.stringify(mergedAliases.sort()) !== JSON.stringify(currentAliases.sort());

        if (needsUpdate) {
          transactions.push(
            db.tx.companies[existingCompany.id].update({
              name,
              aliases: mergedAliases,
              identity: {
                ...existingCompany.identity,
                cik: mergedCiks,
              },
              updated_at: new Date().toISOString(),
            })
          );
          updated++;
          if (mergedCiks.length > currentCiks.length) merged++;
        } else {
          skipped++;
        }
      } else {
        // Create new
        const companyId = generateCompanyId({
          type: "public",
          name,
          identity: { cik: cikArray },
        });

        transactions.push(
          db.tx.companies[companyId].update({
            id: companyId,
            name,
            aliases: Array.from(allAliases).filter((alias) => alias !== name),
            type: "public",
            founded_date: null,
            jurisdiction_iso: null,
            jurisdiction_raw: null,
            identity: { cik: cikArray },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        );
        created++;
      }
    }

    // Execute batch
    if (transactions.length > 0) {
      await db.transact(transactions);
    }
    
    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      console.log(`  Batch ${batchNum}/${totalBatches} complete (${created} created, ${updated} updated, ${skipped} skipped)`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Companies created: ${created.toLocaleString()}`);
  console.log(`Companies updated: ${updated.toLocaleString()}`);
  console.log(`Companies skipped (no changes): ${skipped.toLocaleString()}`);
  console.log(`Companies with merged CIKs: ${merged.toLocaleString()}`);
  console.log("\n✅ Company names and CIKs updated successfully!");
}

main().catch((error) => {
  console.error("Error updating company names and CIKs:", error);
  process.exit(1);
});
