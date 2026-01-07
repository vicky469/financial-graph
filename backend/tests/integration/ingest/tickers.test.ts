import { db } from "../../../src/db/client";
import { describe, it, expect } from "@jest/globals";
import path from "path";
import fs from "fs/promises";

const TICKERS_PATH = path.resolve(
  __dirname,
  "../../../src/data_source/sec/output/company_tickers.json"
);

interface TickerData {
  fields: string[];
  data: (string | number)[][];
}

describe("SEC Ticker Ingestion & Verification", () => {
  // Increase timeout for heavy reconciliation
  jest.setTimeout(30000);

  let sourceMap: Map<string, { name: string; tickers: Set<string> }>;

  it("1. Source Integrity: Should parse source file and identify duplicates", async () => {
    const rawData = await fs.readFile(TICKERS_PATH, "utf-8");
    const json: TickerData = JSON.parse(rawData);
    const { fields, data } = json;

    const cikIdx = fields.indexOf("cik");
    const nameIdx = fields.indexOf("name");
    const tickerIdx = fields.indexOf("ticker");

    // Build a map of the source data for later tests
    sourceMap = new Map();

    for (const row of data) {
      const cik = String(row[cikIdx]).padStart(10, "0");
      const name = String(row[nameIdx]);
      const ticker = String(row[tickerIdx]);

      if (!sourceMap.has(cik)) {
        sourceMap.set(cik, { name, tickers: new Set() });
      }
      sourceMap.get(cik)!.tickers.add(ticker);
    }

    console.log(
      `\n📚 Source Data: ${data.length} raw rows, ${sourceMap.size} unique companies (CIKs).`
    );

    // Assert we actually found data
    expect(sourceMap.size).toBeGreaterThan(0);

    // Check for duplicates (Multi-ticker CIKs) as we know they exist
    const multiTickerCount = Array.from(sourceMap.values()).filter(
      (v) => v.tickers.size > 1
    ).length;
    console.log(`found ${multiTickerCount} companies with multiple tickers.`);
    expect(multiTickerCount).toBeGreaterThan(0);
  });

  it("2. Sanity Check: DB should have data", async () => {
    const res = await db.query({
      companies: {
        $: { limit: 1 },
      },
    });
    expect(res.companies.length).toBeGreaterThan(0);
  });

  it("3. Reconciliation: DB Content should match Source Data exactly", async () => {
    // Fetch ALL public companies from DB
    const res = await db.query({
      companies: {
        $: {
          fields: ["identity", "name"],
          where: { type: "public" },
        },
      },
    });

    const dbCompanies = res.companies;
    console.log(`\n🏦 DB Data: Found ${dbCompanies.length} public companies.`);

    // 1. Count Match
    // We expect at least as many companies as in our source (exact match for this dataset)
    expect(dbCompanies.length).toBeGreaterThanOrEqual(sourceMap.size);

    // 2. Content Match
    const mismatch: any[] = [];
    let matchedCount = 0;

    for (const company of dbCompanies) {
      const dbCik = company.identity?.cik;
      const dbTickers: string[] = company.identity?.tickers || [];

      if (dbCik && sourceMap.has(dbCik)) {
        matchedCount++;
        const source = sourceMap.get(dbCik)!;
        const sourceTickers = Array.from(source.tickers);

        // Check if all source tickers appear in DB
        const missing = sourceTickers.filter((st) => !dbTickers.includes(st));

        if (missing.length > 0) {
          mismatch.push({
            cik: dbCik,
            name: company.name,
            retry_tickers: sourceTickers,
            db_tickers: dbTickers,
          });
        }
      }
    }

    if (mismatch.length > 0) {
      const errorFile = path.resolve(__dirname, "tickers.test_error.json");
      await fs.writeFile(errorFile, JSON.stringify(mismatch, null, 2));
      console.error(
        `Mismatches found! Saved ${mismatch.length} errors to ${errorFile}`
      );
    }

    expect(matchedCount).toBe(sourceMap.size); // All source CIKs were found in DB
    expect(mismatch).toHaveLength(0); // No tickers were missing
    console.log("✅ SEC Ticker Successful: All source data verified in DB.");
  });
});
