import fs from "node:fs/promises";
import path from "node:path";
import { upsertCompany } from "../db/repo";
import type { Company } from "@financial-graph/shared";
import { CompanyType } from "@financial-graph/shared";
import { createLogger } from "../utils/logger";
import { saveFailedRecordsBatch } from "../utils/failed-records";

const logger = createLogger("ticker-ingestion");

const TICKERS_PATH = path.resolve(
  __dirname,
  "../data_source/sec/output/company_tickers.json"
);

interface TickerData {
  fields: string[];
  data: (string | number)[][];
}

async function main() {
  logger.info("Starting Company Tickers Ingestion (Multi-Ticker Support)...");

  try {
    const rawData = await fs.readFile(TICKERS_PATH, "utf-8");
    const json: TickerData = JSON.parse(rawData);

    const { fields, data } = json;
    logger.info(`Found ${data.length} raw records to process.`);

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
    logger.info("Aggregating tickers by CIK...");
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

    logger.info(`Aggregated into ${companiesMap.size} unique companies.`);

    // 2. Ingest
    let processedCount = 0;
    const errors: Array<{ identifier: string; data: any; error: Error | string }> = [];
    const companies = Array.from(companiesMap.entries());
    const BATCH_SIZE = 50;

    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async ([cik, data]) => {
          try {
            const company: Partial<Company> = {
              name: data.name,
              type: CompanyType.PUBLIC,
              identity: {
                primaryCIK: cik,
                tickers: Array.from(data.tickers).join(","),
                exchanges: data.exchange,
              },
            };

            await upsertCompany(company);
          } catch (err) {
            errors.push({ 
              identifier: cik, 
              data: { cik, ...data }, 
              error: err as Error 
            });
          }
        })
      );

      processedCount += batch.length;
      if (processedCount % 1000 === 0) {
        logger.info(`Processed ${processedCount}/${companies.length}...`);
      }
    }

    logger.info("Ingestion complete!", { 
      total: companies.length, 
      succeeded: companies.length - errors.length,
      failed: errors.length 
    });
    
    if (errors.length > 0) {
      const failedPath = await saveFailedRecordsBatch("ticker-ingestion", errors);
      logger.warn(`Encountered ${errors.length} errors. Failed records saved to: ${failedPath}`);
    }
  } catch (error) {
    logger.error("Fatal error during ingestion", { error });
    process.exit(1);
  }
}

main();
