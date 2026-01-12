import { db } from "../db/client";
import { generateFilingId } from "@financial-graph/shared";
import { createLogger } from "../utils/logger";
import "dotenv/config";

const logger = createLogger("ingest/ex21");

// Env Config
const SEC_YEARS = process.env.SEC_YEARS || "2025";
const TARGET_YEARS = SEC_YEARS.split(",").map((y) => y.trim());
const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT || "FinancialGraphBot/1.0 (bot@example.com)";

const CONCURRENCY = 10; // 10 workers
const WORKER_DELAY_MS = 100; // 100ms delay = max 10 req/sec per worker
const BATCH_SIZE = 100; // Batch DB updates

async function main() {
  logger.info(
    `🔍 Looking for 10-K filings for years: ${TARGET_YEARS.join(", ")}...`
  );

  // 1. Query candidates (10-K)
  const allFilings: any[] = [];

  for (const year of TARGET_YEARS) {
    const yearNum = parseInt(year);
    const res = await db.query({
      filing: {
        $: {
          where: {
            form_type: "10-K",
            source_year: yearNum,
          },
        },
      },
    });

    if (res.filing) {
      allFilings.push(...res.filing);
    }
  }

  // 2. Filter out already processed filings (Resume Capability)
  const pendingFilings = allFilings.filter((f) => {
    if (!f.attachments) return true;
    return !Object.keys(f.attachments).some((k) => k.startsWith("EX-21"));
  });

  logger.info(
    `Found ${allFilings.length} total candidates. Resuming with ${pendingFilings.length} pending.`
  );

  let processed = 0;
  let updated = 0;
  const updateBatch: any[] = [];

  // Worker Function
  const processFiling = async (filing: any, index: number) => {
    // Double check (race condition safety)
    if (filing.attachments) {
      const hasEx21 = Object.keys(filing.attachments).some((k) =>
        k.startsWith("EX-21")
      );
      if (hasEx21) return null;
    }

    try {
      if (!filing.file_url) return null;

      logger.info(
        `[${index + 1}/${pendingFilings.length}] Fetching ${filing.file_url}...`,
        {
          filingId: filing.id,
          accession: filing.accession_number,
        }
      );

      const text = await fetchWithRetry(filing.file_url);

      // Regex for EX-21.*
      const regex = /<TYPE>EX-21(\S*)[\s\S]*?<FILENAME>(.*?)\n/i;
      const match = text.match(regex);

      if (match) {
        const typeSuffix = match[1] || "";
        const filename = match[2].trim();
        const typeKey = `EX-21${typeSuffix}`;

        logger.info(`✅ Found ${typeKey}: ${filename}`, {
          filingId: filing.id,
        });

        // Construct URL
        const urlParts = filing.file_url.split("/");
        const cik = urlParts[urlParts.length - 2];
        const accessionNoDashes = filing.accession_number_nodashes;

        const attachmentUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}/${filename}`;

        const attachments = filing.attachments || {};
        attachments[typeKey] = attachmentUrl;

        return { id: filing.id, attachments };
      }
    } catch (e: any) {
      logger.error(`❌ Error processing ${filing.id}: ${e.message}`, {
        filingId: filing.id,
      });
    }
    return null;
  };

  // Flush batch to DB
  const flushBatch = async () => {
    if (updateBatch.length === 0) return;
    
    try {
      const transactions = updateBatch.map((update) =>
        db.tx.filing[update.id].update({ attachments: update.attachments })
      );
      await db.transact(transactions);
      updated += updateBatch.length;
      logger.info(`💾 Batch updated: ${updated} total`);
    } catch (e: any) {
      logger.error(`Failed to update batch: ${e.message}`);
    }
    updateBatch.length = 0;
  };

  // Parallel Execution
  const queue = [...pendingFilings];
  const total = queue.length;

  const worker = async (workerId: number) => {
    while (queue.length > 0) {
      const filing = queue.shift();
      if (!filing) break;

      const currentIdx = total - queue.length - 1;
      const result = await processFiling(filing, currentIdx);

      if (result) {
        updateBatch.push(result);
        
        // Flush when batch is full
        if (updateBatch.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }

      processed++;
      await new Promise((r) => setTimeout(r, WORKER_DELAY_MS));
    }
  };

  const workers = Array(CONCURRENCY)
    .fill(null)
    .map((_, i) => worker(i));
  await Promise.all(workers);

  // Flush remaining
  await flushBatch();

  logger.info(`\n🎉 Done! Processed: ${processed}, Updated: ${updated}`);
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Failed after retries");
}

main();
