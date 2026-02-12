// Job: Download primary HTM files from filing text cache
// Steps:
// 1) Check if cache folder has data for the year and form type(s)
// 2) Read first chunk of TXT from disk, find the first filename ending with .htm where
//    TYPE starts with the requested form type and SEQUENCE=1
// 3) Write filingId:url JSONL and sync filing.filingUrl to InstantDB
// 4) Download the HTM file and save as .gz (unless --skip-download)
//
// CLI:
//   bun run src/jobs/filings_download_htm_gz.ts -- -2025 10-K
//   bun run src/jobs/filings_download_htm_gz.ts -- -2025 10-K 20-F

import fs from "node:fs/promises";
import path from "node:path";
import { createLogger } from "../utils/logger";
import { hasCliFlag, parseCliYears } from "../utils/cli";
import { runWorkerPool } from "../utils/worker-pool";
import { WORKLOAD_PRESETS } from "../utils/workload-config";
import { fetchSecPageWithRetry, SecFetchMode } from "../integration/sec";
import { db } from "../db/client";

const logger = createLogger("jobs/filings_download_htm_gz");

const FILINGS_TEXT_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "data",
  "filings_text",
);

const OUTPUT_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "data",
  "filings_htm",
);
const FILING_HEAD_READ_BYTES = 2 * 1024 * 1024; // Read first 2MB only

type DownloadTask = {
  cik: string;
  accessionNumberNoDashes: string;
  formType: string;
  filename: string;
  url: string;
  destPath: string;
};

type FilingTextInfo = {
  cik: string;
  accessionNumberNoDashes: string;
  formType: string;
  txtPath: string;
};

type FilingIdRow = {
  id: string;
  accession_number_nodashes: string;
};

type FilingUrlRecord = {
  filingId: string;
  filingUrl: string;
};

/**
 * Parse filename to extract CIK and accession number
 * Format: {cik}_{accession_number}.txt
 */
function parseFilingTextFilename(filename: string, formType: string): FilingTextInfo | null {
  if (!filename.endsWith(".txt")) return null;
  
  const base = filename.replace(/\.txt$/, "");
  const parts = base.split("_");
  
  if (parts.length !== 2) return null;
  
  const [cik, accessionNumberNoDashes] = parts;
  
  if (!/^\d+$/.test(cik) || !/^\d+$/.test(accessionNumberNoDashes)) {
    return null;
  }
  
  return {
    cik,
    accessionNumberNoDashes,
    formType,
    txtPath: "", // Will be set by caller
  };
}

/**
 * Extract primary HTML filename from filing text.
 * Looks for <TYPE>{formType}* with <SEQUENCE>1 and <FILENAME>*.htm
 */
export function extractPrimaryHtmFilename(
  body: string,
  formType: string,
): string | null {
  const normalizedFormType = formType.trim().toUpperCase();
  const lines = body.split(/\r?\n/);
  let inDocument = false;
  let docType: string | null = null;
  let sequence: string | null = null;
  let filename: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    const upperLine = line.toUpperCase();

    if (upperLine.startsWith("<DOCUMENT>")) {
      inDocument = true;
      docType = null;
      sequence = null;
      filename = null;
      continue;
    }

    if (!inDocument) continue;

    if (upperLine.startsWith("</DOCUMENT>")) {
      inDocument = false;
      docType = null;
      sequence = null;
      filename = null;
      continue;
    }

    if (docType === null && upperLine.startsWith("<TYPE>")) {
      docType = line.slice("<TYPE>".length).trim().toUpperCase();
    } else if (sequence === null && upperLine.startsWith("<SEQUENCE>")) {
      sequence = line.slice("<SEQUENCE>".length).trim();
    } else if (filename === null && upperLine.startsWith("<FILENAME>")) {
      filename = line.slice("<FILENAME>".length).trim();
    }

    if (
      docType &&
      sequence &&
      filename &&
      docType.startsWith(normalizedFormType) &&
      sequence === "1" &&
      filename.toLowerCase().endsWith(".htm")
    ) {
      return filename;
    }
  }

  return null;
}

/**
 * Read only the file head and extract primary HTM filename from it.
 * We intentionally avoid loading the full filing text file.
 */
async function extractPrimaryHtmFilenameFromFile(
  txtPath: string,
  formType: string,
): Promise<string | null> {
  const fileHandle = await fs.open(txtPath, "r");
  try {
    const buffer = Buffer.alloc(FILING_HEAD_READ_BYTES);
    const { bytesRead } = await fileHandle.read(
      buffer,
      0,
      FILING_HEAD_READ_BYTES,
      0,
    );
    if (bytesRead <= 0) return null;
    const head = buffer.subarray(0, bytesRead).toString("utf-8");
    return extractPrimaryHtmFilename(head, formType);
  } finally {
    await fileHandle.close();
  }
}

/**
 * Scan cache directory for filing text files
 */
async function scanCacheDirectory(year: number, formType: string): Promise<FilingTextInfo[]> {
  const cacheDir = path.join(FILINGS_TEXT_ROOT, String(year), formType);
  
  try {
    await fs.access(cacheDir);
  } catch {
    logger.error(`Cache directory not found: ${cacheDir}`);
    return [];
  }
  
  const entries = await fs.readdir(cacheDir, { withFileTypes: true });
  const filings: FilingTextInfo[] = [];
  
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    
    const parsed = parseFilingTextFilename(entry.name, formType);
    if (!parsed) continue;
    
    parsed.txtPath = path.join(cacheDir, entry.name);
    filings.push(parsed);
  }
  
  logger.info(`Found ${filings.length} filing text files in ${cacheDir}`);
  return filings;
}

/**
 * Create download tasks from filing text files
 */
async function createDownloadTasks(
  filings: FilingTextInfo[],
  year: number,
): Promise<DownloadTask[]> {
  logger.info(`Processing ${filings.length} filing text files to extract HTM filenames`);
  
  const workload = WORKLOAD_PRESETS.fastIO(filings.length);
  const scanConcurrency = Math.min(workload.concurrency, 4);
  logger.info("File processing workload", {
    filings: filings.length,
    concurrency: scanConcurrency,
    reasoning: `${workload.reasoning}; capped for memory safety`,
  });
  
  const pool = await runWorkerPool<FilingTextInfo, DownloadTask | null>({
    tasks: filings,
    concurrency: scanConcurrency,
    worker: async (filing) => {
      const htmFilename = await extractPrimaryHtmFilenameFromFile(
        filing.txtPath,
        filing.formType,
      );
      
      if (!htmFilename) {
        logger.warn(`No primary HTM file found for ${filing.cik}_${filing.accessionNumberNoDashes}`);
        return null;
      }
      
      const cikUrl = filing.cik.replace(/^0+/, "") || filing.cik;
      const url = `https://www.sec.gov/Archives/edgar/data/${cikUrl}/${filing.accessionNumberNoDashes}/${htmFilename}`;
      
      const destPath = path.join(
        OUTPUT_ROOT,
        String(year),
        filing.formType,
        `${filing.cik}_${filing.accessionNumberNoDashes}_${htmFilename}.gz`,
      );
      
      return {
        cik: filing.cik,
        accessionNumberNoDashes: filing.accessionNumberNoDashes,
        formType: filing.formType,
        filename: htmFilename,
        url,
        destPath,
      };
    },
    onProgress: (stats) => {
      if (stats.completed % 100 === 0 || stats.completed === stats.total) {
        logger.info(
          `File processing progress: completed=${stats.completed}/${stats.total}, remaining=${stats.remaining}`,
        );
      }
    },
    progressInterval: 100,
  });
  
  const tasks = pool.results.filter((task): task is DownloadTask => task !== null);
  
  logger.info(`Created ${tasks.length} download tasks from ${filings.length} filings (${pool.errors.length} errors)`);
  return tasks;
}

/**
 * Build map: accession_number_nodashes -> filing.id for a year + form prefix.
 */
async function loadFilingIdMap(
  year: number,
  formType: string,
): Promise<Map<string, string>> {
  const res = await db.query({
    filing: {
      $: {
        where: {
          source_year: year,
          form_type: { $like: `${formType}%` },
        },
        fields: ["id", "accession_number_nodashes"],
        limit: 200000,
      },
    },
  });

  const rows = (res.filing || []) as FilingIdRow[];
  return new Map(
    rows
      .filter(
        (row) =>
          !!row.id &&
          !!row.accession_number_nodashes &&
          row.accession_number_nodashes.length > 0,
      )
      .map((row) => [row.accession_number_nodashes, row.id]),
  );
}

/**
 * Save filingId + filingUrl records as JSONL and sync filing.filingUrl in DB.
 */
async function persistFilingUrlsAndJsonl(
  tasks: DownloadTask[],
  year: number,
  formType: string,
): Promise<void> {
  const filingIdMap = await loadFilingIdMap(year, formType);
  const jsonlPath = path.join(
    OUTPUT_ROOT,
    String(year),
    formType,
    "filing_urls.jsonl",
  );
  await fs.mkdir(path.dirname(jsonlPath), { recursive: true });

  const records: FilingUrlRecord[] = [];
  let missing = 0;
  for (const task of tasks) {
    const filingId = filingIdMap.get(task.accessionNumberNoDashes);
    if (!filingId) {
      missing += 1;
      continue;
    }
    records.push({
      filingId,
      filingUrl: task.url,
    });
  }

  if (missing > 0) {
    logger.warn(`Missing filing IDs when writing filing URL JSONL`, {
      year,
      formType,
      missing,
    });
  }

  const jsonl = records.map((r) => JSON.stringify(r)).join("\n");
  const writeJsonlPromise = fs.writeFile(
    jsonlPath,
    jsonl.length > 0 ? `${jsonl}\n` : "",
    "utf-8",
  );

  const syncDbPromise = (async () => {
    if (records.length === 0) return;
    const BATCH_SIZE = 200;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const txs = batch.map((record) =>
        db.tx.filing[record.filingId].update({
          filingUrl: record.filingUrl,
          updated_at: new Date().toISOString(),
        }),
      );
      await db.transact(txs);
    }
  })();

  await Promise.all([writeJsonlPromise, syncDbPromise]);

  logger.info(`Saved filing URLs to JSONL and InstantDB`, {
    year,
    formType,
    updated: records.length,
    path: jsonlPath,
  });
}

/**
 * Download and compress HTM file
 */
async function downloadTask(task: DownloadTask): Promise<void> {
  const content = await fetchSecPageWithRetry(task.url, SecFetchMode.TEXT);
  const buffer = Buffer.from(content, "utf-8");
  
  await fs.mkdir(path.dirname(task.destPath), { recursive: true });
  const gz = await import("node:zlib").then((z) => z.gzipSync(buffer));
  await fs.writeFile(task.destPath, gz);
}

/**
 * Process a single form type for a year
 */
async function processFormType(
  year: number,
  formType: string,
  options: { skipDownload: boolean },
): Promise<void> {
  logger.info(`Processing ${formType} for ${year}`);
  
  // Step 1: Scan cache directory
  const filings = await scanCacheDirectory(year, formType);
  
  if (filings.length === 0) {
    logger.error(`No filing text files found for ${year}/${formType}`);
    logger.error(`Please run subsidiary_filings.ts first to download filing text files`);
    return;
  }
  
  // Step 2: Create download tasks
  const tasks = await createDownloadTasks(filings, year);
  
  if (tasks.length === 0) {
    logger.warn(`No HTM files found for ${year}/${formType}`);
    return;
  }

  // Step 3: Persist filingId:url to JSONL and InstantDB together
  await persistFilingUrlsAndJsonl(tasks, year, formType);

  // Step 4: Download HTM files (optional)
  if (options.skipDownload) {
    logger.info(`Skipping file download (--skip-download enabled)`, {
      year,
      formType,
      generatedUrls: tasks.length,
    });
    return;
  }

  const workload = WORKLOAD_PRESETS.secApi(tasks.length);
  logger.info("Download workload", {
    year,
    formType,
    tasks: tasks.length,
    concurrency: workload.concurrency,
    reasoning: workload.reasoning,
  });
  
  const pool = await runWorkerPool<DownloadTask, void>({
    tasks,
    concurrency: workload.concurrency,
    worker: downloadTask,
    onProgress: (stats) => {
      if (stats.completed % 50 === 0 || stats.completed === stats.total) {
        logger.info(
          `Download progress: completed=${stats.completed}/${stats.total}, remaining=${stats.remaining}`,
        );
      }
    },
    progressInterval: 50,
  });
  
  logger.info(`Download complete for ${year}/${formType}`, {
    successful: pool.results.length,
    failed: pool.errors.length,
  });
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const years = parseCliYears(args);
    const skipDownload = hasCliFlag(args, "skip-download");
    
    // Extract form types from remaining args
    const formTypes = args.filter(arg => !arg.startsWith("-") && !/^\d{4}$/.test(arg));
    
    if (formTypes.length === 0) {
      logger.error("No form types specified");
      logger.error(
        "Usage: bun run src/jobs/filings_download_htm_gz.ts -- -2025 10-K 20-F [--skip-download]",
      );
      process.exit(1);
    }
    
    logger.info("CLI parsed", { years, formTypes, skipDownload });
    
    for (const year of years) {
      for (const formType of formTypes) {
        await processFormType(year, formType, { skipDownload });
      }
    }
    
    logger.info("Job complete");
  } catch (error) {
    const err = error as Error;
    logger.error("Job failed", { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
