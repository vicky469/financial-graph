// Job: Fetch SEC company_tickers_exchange JSON, store the raw payload, aggregate
// tickers by CIK into a deduped company list, persist JSON with metadata, and
// batch-ingest the companies into the graph database using the "simple" preset.
import fs from "node:fs/promises";
import path from "node:path";
import { INDEX_DIR } from "../config/config";
import { fetchSecJSON } from "../integration/sec";
import { createLogger } from "../utils/logger";
import { db } from "../db/client";
import { writeJsonWithMeta } from "../utils/fs";
import { createJobConfig, finalizeJobConfig } from "../config/jobConfig";
import { runWorkerPool } from "../utils/worker-pool";
import { WORKLOAD_PRESETS } from "../utils/workload-config";
import type { Company } from "@financial-graph/shared";
import {
  CompanyType,
  CompanySchema,
  validate,
  generateCompanyId,
} from "@financial-graph/shared";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const OUTPUT_JSON = path.join(INDEX_DIR, "company_tickers.json");
const OUTPUT_RAW_JSON = path.join(INDEX_DIR, "raw_company_tickers.json");
const jobConfig = createJobConfig(
  "company_tickers_exchange",
  "data",
  TICKERS_URL,
);

const logger = createLogger("jobs/company_tickers_exchange");

type RawTickerRow = (string | number)[];

interface TickerData {
  fields: string[];
  data: RawTickerRow[];
}

interface AggregatedCompany {
  cik: string;
  name: string;
  tickers: string[];
  exchange?: string;
}

/**
 * Step 1: Fetch SEC company tickers + exchange list and save to JSON.
 */
export async function get(): Promise<TickerData> {
  logger.info(`Fetching tickers from ${TICKERS_URL}...`);

  const data = await fetchSecJSON<TickerData>(TICKERS_URL);
  const rows = Array.isArray(data?.data) ? data.data : [];
  logger.info(
    `Successfully fetched ${rows.length.toLocaleString()} companies.`,
    {
      count: rows.length,
      source: jobConfig.sourceUrl,
    },
  );

  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_RAW_JSON, JSON.stringify(data, null, 2), {
    encoding: "utf-8",
    flag: "w",
  });
  logger.info("Saved raw tickers JSON", { path: OUTPUT_RAW_JSON });

  return data;
}

export async function saveAggregatedJSON(
  companies: AggregatedCompany[],
): Promise<void> {
  const uniqueCompanies = companies.length;

  const { meta } = await writeJsonWithMeta({
    filePath: OUTPUT_JSON,
    source: jobConfig.sourceUrl,
    data: companies,
    notes: { job: finalizeJobConfig(jobConfig, "success") },
  });

  logger.info("Saved aggregated ticker JSON", {
    path: OUTPUT_JSON,
    records: meta.records,
    fileSize: meta.fileSize,
  });
}

/**
 * Step 2.1: Aggregate raw ticker data into unique companies keyed by CIK.
 */
export function aggregateTickers({
  fields,
  data,
}: TickerData): AggregatedCompany[] {
  logger.info(`Found ${data.length} raw records to process.`);

  const cikIdx = fields.indexOf("cik");
  const nameIdx = fields.indexOf("name");
  const tickerIdx = fields.indexOf("ticker");
  const exchangeIdx = fields.indexOf("exchange");

  if (cikIdx === -1 || nameIdx === -1 || tickerIdx === -1) {
    throw new Error(
      "Missing required fields (cik, name, ticker) in JSON structure.",
    );
  }

  const companiesMap = new Map<
    string,
    { name: string; tickers: Set<string>; exchange?: string }
  >();
  const duplicates: Array<{ cik: string; ticker: string }> = [];

  for (const row of data) {
    const cik = String(row[cikIdx]).padStart(10, "0");
    const name = String(row[nameIdx]);
    const ticker = String(row[tickerIdx]);
    const exchange = exchangeIdx !== -1 ? String(row[exchangeIdx]) : undefined;

    if (!companiesMap.has(cik)) {
      companiesMap.set(cik, {
        name,
        tickers: new Set(),
        exchange,
      });
    }

    const company = companiesMap.get(cik)!;
    if (company.tickers.has(ticker)) {
      duplicates.push({ cik, ticker });
    } else {
      company.tickers.add(ticker);
    }
  }

  const companies: AggregatedCompany[] = Array.from(companiesMap.entries()).map(
    ([cik, value]) => ({
      cik,
      name: value.name,
      tickers: Array.from(value.tickers),
      exchange: value.exchange,
    }),
  );

  const multiTicker = companies.filter((c) => c.tickers.length > 1).length;

  const multiTickerExamples = companies
    .filter((c) => c.tickers.length > 1)
    .slice(0, 5)
    .map((c) => ({
      cik: c.cik,
      tickers: c.tickers,
      exchange: c.exchange,
    }));

  const multiTickerPct = Number(
    ((multiTicker / companies.length) * 100).toFixed(2),
  );

  logger.info(
    `Aggregated into ${companies.length} unique companies. ` +
      `Multi-ticker: ${multiTicker} (${multiTickerPct}%). ` +
      `Examples: ${JSON.stringify(multiTickerExamples)}. ` +
      `Raw rows: ${data.length}.`,
  );
  if (duplicates.length > 0) {
    logger.warn("Duplicate ticker entries encountered", {
      count: duplicates.length,
      samples: duplicates.slice(0, 5),
    });
  }
  return companies;
}

/**
 * Step 2.2: Persist aggregated companies to DB in parallel.
 */
export async function saveToDB(companies: AggregatedCompany[]): Promise<void> {
  const workload = WORKLOAD_PRESETS.fastIO(companies.length);
  const BATCH_SIZE = workload.batchSize;

  const batches: AggregatedCompany[][] = [];
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    batches.push(companies.slice(i, i + BATCH_SIZE));
  }

  logger.info("Starting parallel ingestion", {
    concurrency: workload.concurrency,
    batchSize: BATCH_SIZE,
    batches: batches.length,
    total: companies.length,
  });
  logger.debug(`Workload reasoning: ${workload.reasoning}`);

  const buildNode = (entry: AggregatedCompany): Company => {
    const id = generateCompanyId({
      type: CompanyType.PUBLIC,
      name: entry.name,
      identity: { primaryCIK: entry.cik },
    });

    const node: Company = {
      id,
      name: entry.name,
      aliases: [],
      type: CompanyType.PUBLIC,
      jurisdiction_iso: undefined,
      jurisdiction_raw: undefined,
      identity: {
        primaryCIK: entry.cik,
        tickers: entry.tickers.join(","),
        exchanges: entry.exchange,
      },
      updated_at: new Date().toISOString(),
    };

    validate(CompanySchema, node);
    return node;
  };

  await runWorkerPool({
    concurrency: workload.concurrency,
    tasks: batches,
    worker: async (batch) => {
      const txs = batch.map((entry) => {
        const node = buildNode(entry);
        return db.tx.company[node.id].update(node);
      });
      await db.transact(txs);
      return batch.length;
    },
    onProgress: (stats) => {
      const processed = stats.completed * BATCH_SIZE;
      logger.info(`Processed ${processed}/${companies.length}...`);
    },
    progressInterval: 5,
  });

  logger.info("Ingestion complete!", {
    total: companies.length,
  });
}

async function main() {
  try {
    const data = await get(); // 1) fetch and write JSON
    const companies = aggregateTickers(data); // 2) aggregate in-memory
    await saveAggregatedJSON(companies); // 3) persist aggregated JSON
    await saveToDB(companies); // 4) persist to DB
  } catch (error) {
    const err = error as Error;
    logger.error("Error running company_tickers_exchange job", {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
