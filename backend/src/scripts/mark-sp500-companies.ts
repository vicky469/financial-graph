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
import type { Company } from "../types";

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
  console.log("Loading S&P 500 list...");
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
    companies: {
      $: {
        where: { type: "public" },
      },
    },
  });

  const companies = (result.companies || []) as Company[];
  console.log(`Found ${companies.length.toLocaleString()} public companies\n`);

  // Match companies
  const matched: Array<{ company: Company; sp500: SP500Company }> = [];
  const unmatched: SP500Company[] = [];

  for (const sp500Company of sp500Companies) {
    let found = false;

    // Try to match by CIK
    for (const company of companies) {
      const ciks = company.identity?.cik || [];
      if (ciks.includes(sp500Company.cik)) {
        matched.push({ company, sp500: sp500Company });
        found = true;
        break;
      }
    }

    // Try to match by ticker if CIK didn't work
    if (!found) {
      for (const company of companies) {
        const tickers = company.identity?.tickers || [];
        const upperTickers = tickers.map((t) => t.toUpperCase());
        if (upperTickers.includes(sp500Company.symbol.toUpperCase())) {
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
      db.tx.companies[company.id].update({
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
  
  const sp500Ciks = new Set(sp500Companies.map(c => c.cik));
  const sp500Tickers = new Set(sp500Companies.map(c => c.symbol.toUpperCase()));
  
  const toUnmark = companies.filter((company) => {
    // Skip if not currently marked as S&P 500
    if (!company.identity?.sp500) return false;
    
    // Check if still in S&P 500
    const ciks = company.identity?.cik || [];
    const tickers = (company.identity?.tickers || []).map(t => t.toUpperCase());
    
    const hasSP500Cik = ciks.some(cik => sp500Ciks.has(cik));
    const hasSP500Ticker = tickers.some(ticker => sp500Tickers.has(ticker));
    
    return !hasSP500Cik && !hasSP500Ticker;
  });

  if (toUnmark.length > 0) {
    console.log(`Found ${toUnmark.length} companies to unmark`);
    
    let unmarked = 0;
    for (let i = 0; i < toUnmark.length; i += BATCH_SIZE) {
      const batch = toUnmark.slice(i, i + BATCH_SIZE);
      const transactions = batch.map((company) =>
        db.tx.companies[company.id].update({
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
