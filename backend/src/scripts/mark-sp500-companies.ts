/**
 * Mark S&P 500 Companies in Database
 * 
 * This script reads the S&P 500 list and adds a flag to companies in the database.
 * We'll add this to the public_info table as it's market-related information.
 * 
 * Run: bun src/scripts/mark-sp500-companies.ts
 */

import fs from "fs/promises";
import path from "path";
import { db } from "../db/client";
import type { Company } from "@financial-graph/shared";
import { CompanyType } from "@financial-graph/shared";

const SP500_FILE = path.join(
  __dirname,
  "../data_source/sp500/output/sp500_companies.json"
);

interface SP500Company {
  symbol: string;
  name: string;
  cik: string;
  sector: string;
  subIndustry: string;
  headquarters: string;
  dateAdded: string;
  founded: string;
}

async function main() {
  console.log("📊 Marking S&P 500 companies...\n");

  // Load S&P 500 list
  console.log("Loading S&P 500 list from file...");
  const sp500Data = await fs.readFile(SP500_FILE, "utf-8");
  const sp500Companies: SP500Company[] = JSON.parse(sp500Data);

  console.log(`Loaded ${sp500Companies.length} S&P 500 companies\n`);

  // Create lookup maps
  const sp500ByCik = new Map<string, SP500Company>();
  const sp500ByTicker = new Map<string, SP500Company>();

  sp500Companies.forEach((company) => {
    sp500ByCik.set(company.cik, company);
    sp500ByTicker.set(company.symbol.toUpperCase(), company);
  });

  // Fetch all public companies
  console.log("Fetching companies from database...");
  const result = await db.query({
    company: {
      $: {
        where: { type: CompanyType.PUBLIC },
      },
    },
  });

  const companies = (result.company || []) as Company[];
  console.log(`Found ${companies.length.toLocaleString()} public companies\n`);

  // Match companies
  const matched: Array<{ company: Company; sp500: SP500Company }> = [];
  const unmatched: SP500Company[] = [];

  for (const sp500Company of sp500Companies) {
    let found = false;

    // Try to match by CIK (check primaryCIK first, then fall back to ciks)
    for (const company of companies) {
      const primaryCIK = company.identity?.primaryCIK;
      const ciks = company.identity?.ciks;
      
      // First check primaryCIK
      if (primaryCIK && primaryCIK === sp500Company.cik) {
        matched.push({ company, sp500: sp500Company });
        found = true;
        break;
      }
      
      // Fall back to checking ciks string (comma-separated)
      if (!found && ciks) {
        const cikList = ciks.split(',').map((c: string) => c.trim());
        if (cikList.includes(sp500Company.cik)) {
          matched.push({ company, sp500: sp500Company });
          found = true;
          break;
        }
      }
    }

    // Try to match by ticker if CIK didn't work
    if (!found) {
      for (const company of companies) {
        const tickers = company.identity?.tickers?.split(',').map((t: string) => t.trim().toUpperCase()) || [];
        if (tickers.includes(sp500Company.symbol.toUpperCase())) {
          matched.push({ company, sp500: sp500Company });
          found = true;
          break;
        }
      }
    }

    if (!found) {
      unmatched.push(sp500Company);
    }
  }

  console.log(`Matched: ${matched.length} companies`);
  console.log(`Unmatched: ${unmatched.length} companies\n`);

  if (unmatched.length > 0) {
    console.log("Unmatched S&P 500 companies:");
    console.log("=".repeat(80));
    unmatched.slice(0, 10).forEach((company) => {
      console.log(`${company.symbol} - ${company.name} (CIK: ${company.cik})`);
    });
    if (unmatched.length > 10) {
      console.log(`... and ${unmatched.length - 10} more`);
    }
    console.log();
  }

  console.log("Updating companies with S&P 500 flag...");

  const BATCH_SIZE = 100;
  let updated = 0;

  for (let i = 0; i < matched.length; i += BATCH_SIZE) {
    const batch = matched.slice(i, i + BATCH_SIZE);
    const transactions = batch.map(({ company, sp500 }) =>
      db.tx.company[company.id].update({
        identity: {
          ...company.identity,
          sp500: true, // Simple boolean flag
        },
        updated_at: new Date().toISOString(),
      })
    );

    await db.transact(transactions);
    updated += batch.length;

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= matched.length) {
      console.log(`  Updated ${updated} / ${matched.length} companies...`);
    }
  }

  // Clear S&P 500 flag from companies no longer in the index
  console.log("\nClearing S&P 500 flag from companies no longer in index...");
  
  const sp500Ciks = new Set(sp500Companies.map((c: SP500Company) => c.cik));
  const sp500Tickers = new Set(sp500Companies.map((c: SP500Company) => c.symbol.toUpperCase()));
  
  const toUnmark = companies.filter((company) => {
    // Skip if not currently marked as S&P 500
    if (!company.identity?.sp500) return false;
    
    // Check if still in S&P 500 (check primaryCIK first, then ciks)
    const primaryCIK = company.identity?.primaryCIK;
    const ciks = company.identity?.ciks;
    const tickers = company.identity?.tickers?.split(',').map((t: string) => t.trim().toUpperCase()) || [];
    
    // Check primaryCIK first
    let hasSP500Cik = primaryCIK ? sp500Ciks.has(primaryCIK) : false;
    
    // If not found in primaryCIK, check ciks string
    if (!hasSP500Cik && ciks) {
      const cikList = ciks.split(',').map((c: string) => c.trim());
      hasSP500Cik = cikList.some((cik: string) => sp500Ciks.has(cik));
    }
    
    const hasSP500Ticker = tickers.some((ticker: string) => sp500Tickers.has(ticker));
    
    return !hasSP500Cik && !hasSP500Ticker;
  });

  if (toUnmark.length > 0) {
    console.log(`Found ${toUnmark.length} companies to unmark`);
    
    let unmarked = 0;
    for (let i = 0; i < toUnmark.length; i += BATCH_SIZE) {
      const batch = toUnmark.slice(i, i + BATCH_SIZE);
      const transactions = batch.map((company) =>
        db.tx.company[company.id].update({
          identity: {
            ...company.identity,
            sp500: false,
          },
          updated_at: new Date().toISOString(),
        })
      );

      await db.transact(transactions);
      unmarked += batch.length;
    }
    console.log(`Unmarked ${unmarked} companies`);
  } else {
    console.log("No companies to unmark");
  }

  console.log("\n=== Summary ===");
  console.log(`S&P 500 companies in list: ${sp500Companies.length}`);
  console.log(`Matched in database: ${matched.length}`);
  console.log(`Not found in database: ${unmatched.length}`);
  console.log(`Companies updated: ${updated}`);

  // Sector breakdown
  console.log("\nS&P 500 Sector Breakdown:");
  console.log("=".repeat(80));
  const sectors = new Map<string, number>();
  matched.forEach(({ sp500 }) => {
    sectors.set(sp500.sector, (sectors.get(sp500.sector) || 0) + 1);
  });

  Array.from(sectors.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([sector, count]) => {
      console.log(`${sector}: ${count} companies`);
    });

  console.log("\n✅ S&P 500 companies marked successfully!");
}

main().catch((error) => {
  console.error("Error marking S&P 500 companies:", error);
  process.exit(1);
});
