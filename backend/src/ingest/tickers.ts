import fs from "node:fs/promises";
import path from "node:path";
import { upsertCompany } from "../db/repo";
import type { Company } from "../types";

const TICKERS_PATH = path.resolve(
  __dirname,
  "../data_source/sec/output/company_tickers.json"
);

interface TickerData {
  fields: string[];
  data: (string | number)[][];
}

async function main() {
  console.log(
    "🚀 Starting Company Tickers Ingestion (Multi-Ticker Support)..."
  );

  try {
    const rawData = await fs.readFile(TICKERS_PATH, "utf-8");
    const json: TickerData = JSON.parse(rawData);

    const { fields, data } = json;
    console.log(`Found ${data.length} raw records to process.`);

    // Map fields to indices
    const cikIdx = fields.indexOf("cik");
    const nameIdx = fields.indexOf("name");
    const tickerIdx = fields.indexOf("ticker");
    const exchangeIdx = fields.indexOf("exchange");

    if (cikIdx === -1 || nameIdx === -1 || tickerIdx === -1) {
      throw new Error(
        "Missing required fields (cik, name, ticker) in JSON structure."
      );
    }

    // 1. Aggregate by CIK
    console.log("Aggregating tickers by CIK...");
    const companiesMap = new Map<
      string,
      {
        name: string;
        tickers: Set<string>;
        exchange: string | undefined;
      }
    >();

    for (const row of data) {
      const cik = String(row[cikIdx]).padStart(10, "0");
      const name = String(row[nameIdx]);
      const ticker = String(row[tickerIdx]);
      const exchange =
        exchangeIdx !== -1 ? String(row[exchangeIdx]) : undefined;

      if (!companiesMap.has(cik)) {
        companiesMap.set(cik, {
          name,
          tickers: new Set(),
          exchange,
        });
      }

      const company = companiesMap.get(cik)!;
      company.tickers.add(ticker);

      // Keep the name associated with the most recent entry if needed, but usually they are same.
      // We'll trust the first one or just overwrite.
    }

    console.log(`Aggregated into ${companiesMap.size} unique companies.`);

    // 2. Ingest
    let processedCount = 0;
    const errors: any[] = [];
    const companies = Array.from(companiesMap.entries());
    const BATCH_SIZE = 50;

    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async ([cik, data]) => {
          try {
            const company: Partial<Company> = {
              name: data.name,
              type: "public",
              // Default to Unknown since source JSON doesn't provide jurisdiction; will be nullable
              jurisdiction_raw: null,
              identity: {
                cik: cik,
                tickers: Array.from(data.tickers), // Convert Set to Array
                exchange: data.exchange,
              },
            };

            await upsertCompany(company);
          } catch (err) {
            errors.push({ cik, err });
          }
        })
      );

      processedCount += batch.length;
      if (processedCount % 1000 === 0) {
        console.log(`Processed ${processedCount}/${companies.length}...`);
      }
    }

    console.log("✅ Ingestion complete!");
    if (errors.length > 0) {
      console.warn(
        `⚠️ Encountered ${errors.length} errors. Saving to failed_tickers.json...`
      );
      const errorLogPath = path.join(__dirname, "failed_tickers.json");
      await fs.writeFile(errorLogPath, JSON.stringify(errors, null, 2));
      console.log(`❌ Failed records saved to: ${errorLogPath}`);
    }
  } catch (error) {
    console.error("❌ Fatal error during ingestion:", error);
    process.exit(1);
  }
}

main();
