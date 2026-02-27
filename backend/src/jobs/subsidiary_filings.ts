// Job: Download filing forms and extract EX-21/EX-8 exhibit URLs and period_of_report.
// Steps:
// 1) Fetch candidate filings (by form prefix + year).
// 2) Download TXT bodies (low concurrency for SEC) and store under filing_text dir.
// 3) Read TXT from disk, parse exhibits + period_of_report; batch update attachments in DB.

import { db } from "../db/client";
import { createLogger } from "../utils/logger";
import { hasCliFlag, parseYearsAndQuarters } from "../utils/cli";
import { fetchSecPageWithRetry } from "../integration/sec";
import { runWorkerPool, runWorkerPoolVoid } from "../utils/worker-pool";
import fs from "node:fs/promises";
import path from "node:path";
import {
  SUBSIDIARY_EXHIBITS,
  type SubsidiaryExhibit,
} from "../config/subsidiary-exhibits";
import { SEC_QUARTERS } from "../config/config";

const logger = createLogger("jobs/subsidiary_filings");

type FilingRow = {
  id: string;
  accession_number: string;
  accession_number_nodashes: string;
  file_url: string;
  source_year?: number;
  attachments?: Record<string, string>;
  period_of_report?: string;
};

type ExhibitRule = {
  formPrefix: string;
  exhibitPrefix: SubsidiaryExhibit;
};

const EXHIBIT_FORM_PREFIX: Record<SubsidiaryExhibit, string> = {
  "EX-21": "10-K",
  "EX-8": "20-F",
};

const EXHIBIT_RULES: ExhibitRule[] = SUBSIDIARY_EXHIBITS.map(
  (exhibitPrefix) => ({
    formPrefix: EXHIBIT_FORM_PREFIX[exhibitPrefix],
    exhibitPrefix,
  }),
);

const CACHE_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "data",
  "filings_text",
);
const FAILED_REPORT_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "logs",
  "subsidiary_filings_failed",
);

// Tunables
const DOWNLOAD_CONCURRENCY = 1; // SEC-safe
const PROCESS_BATCH_SIZE = 200;
const PROCESS_CONCURRENCY = 6;

type DownloadFailureRecord = {
  input: {
    id: string;
    accession_number_nodashes: string;
    file_url: string;
    source_year?: number;
    source_quarter: number;
    exhibit_prefix: string;
  };
  reason: string;
};

type DownloadResult = {
  downloaded: number;
  failed: number;
  downloadedIds: Set<string>;
  failureReportPath?: string;
};

function getCachePath(
  filing: FilingRow,
  exhibitPrefix: string,
  quarter?: number,
  useQuarterSubdir = false,
): string {
  if (!filing.source_year) {
    throw new Error(
      `Missing source_year for filing ${filing.accession_number_nodashes}; cannot cache`,
    );
  }
  
  // Extract CIK from file_url
  // URL format: https://www.sec.gov/Archives/edgar/data/{cik}/{accession_number_nodashes}/{filename}
  const cik = filing.file_url.split("/").slice(-2, -1)[0];
  
  const formType = EXHIBIT_FORM_PREFIX[exhibitPrefix as SubsidiaryExhibit];
  const fileName = `${cik}_${filing.accession_number_nodashes}.txt`;
  if (useQuarterSubdir && quarter) {
    return path.join(
      CACHE_ROOT,
      String(filing.source_year),
      `Q${quarter}`,
      formType,
      fileName,
    );
  }
  return path.join(CACHE_ROOT, String(filing.source_year), formType, fileName);
}

function extractExhibits(
  body: string,
  exhibitPrefix: string,
): Array<{ typeKey: string; filename: string }> {
  const regex = new RegExp(
    `<TYPE>${exhibitPrefix}(\\S*)[\\s\\S]*?<FILENAME>(.*?)\\n`,
    "gi",
  );
  const results: Array<{ typeKey: string; filename: string }> = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    const suffix = match[1] || "";
    const filename = match[2].trim();
    const typeKey = `${exhibitPrefix}${suffix}`;
    results.push({ typeKey, filename });
  }
  return results;
}

function extractPeriodOfReport(body: string): string | undefined {
  const match =
    body.match(/CONFORMED PERIOD OF REPORT:\s*(\d{8})/i) ||
    body.match(/PERIOD OF REPORT:\s*(\d{8})/i);
  if (!match) return undefined;
  const d = match[1];
  if (d.length !== 8) return undefined;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

async function fetchCandidates(
  year: number,
  quarter: number,
  formPrefix: string,
  exhibitPrefix: string,
): Promise<FilingRow[]> {
  const base = await db.query({
    filing: {
      $: {
        where: {
          source_year: year,
          source_quarter: quarter,
          form_type: { $like: `${formPrefix}%` },
        },
        fields: [
          "id",
          "accession_number_nodashes",
          "file_url",
          "source_year",
          "attachments",
        ],
        limit: 200000,
      },
    },
  });

  const rows = ((base.filing || []) as FilingRow[]).map((row) => ({
    ...row,
    attachments: row.attachments ?? {},
  }));

  logger.info(
    `Fetched filings: total=${rows.length}, year=${year}, quarter=${quarter}, form=${formPrefix}, exhibit=${exhibitPrefix}`,
  );

  return rows;
}

async function clearCacheDir(
  year: number,
  quarter: number,
  useQuarterSubdir: boolean,
  exhibitPrefix: string,
): Promise<string> {
  const formType = EXHIBIT_FORM_PREFIX[exhibitPrefix as SubsidiaryExhibit];
  const dir = useQuarterSubdir
    ? path.join(CACHE_ROOT, String(year), `Q${quarter}`, formType)
    : path.join(CACHE_ROOT, String(year), formType);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function downloadFilingTexts(
  year: number,
  quarter: number,
  useQuarterSubdir: boolean,
  filings: FilingRow[],
  exhibitPrefix: string,
): Promise<DownloadResult> {
  if (filings.length === 0) {
    return {
      downloaded: 0,
      failed: 0,
      downloadedIds: new Set<string>(),
    };
  }

  await clearCacheDir(year, quarter, useQuarterSubdir, exhibitPrefix);

  logger.info(
    `Downloading filing texts: total=${filings.length}, year=${year}, quarter=${quarter}, concurrency=${DOWNLOAD_CONCURRENCY}, exhibit=${exhibitPrefix}`,
  );

  const downloadedIds = new Set<string>();
  const pool = await runWorkerPoolVoid<FilingRow>({
    tasks: filings,
    concurrency: DOWNLOAD_CONCURRENCY,
    worker: async (filing) => {
      const cachePath = getCachePath(
        filing,
        exhibitPrefix,
        quarter,
        useQuarterSubdir,
      );
      const body = await fetchSecPageWithRetry(filing.file_url);
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, body, "utf-8");
      downloadedIds.add(filing.id);
    },
    onProgress: (stats) => {
      const done = stats.completed + stats.failed;
      if (done % 50 === 0 || done === stats.total) {
        logger.info(
          `Download progress: completed=${stats.completed}/${stats.total}, failed=${stats.failed}, remaining=${stats.remaining}`,
        );
      }
    },
    progressInterval: 50,
  });

  const failures: DownloadFailureRecord[] = pool.errors.map(({ task, error }) => {
    const filing = task as FilingRow;
    return {
      input: {
        id: filing.id,
        accession_number_nodashes: filing.accession_number_nodashes,
        file_url: filing.file_url,
        source_year: filing.source_year,
        source_quarter: quarter,
        exhibit_prefix: exhibitPrefix,
      },
      reason: error.message,
    };
  });

  let failureReportPath: string | undefined;
  if (failures.length > 0) {
    await fs.mkdir(FAILED_REPORT_DIR, { recursive: true });
    const safeTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    failureReportPath = path.join(
      FAILED_REPORT_DIR,
      `download-failures-${year}-Q${quarter}-${exhibitPrefix}-${safeTimestamp}.json`,
    );
    await fs.writeFile(
      failureReportPath,
      JSON.stringify(
        {
          job: "subsidiary_filings",
          year,
          quarter,
          exhibit_prefix: exhibitPrefix,
          generated_at: new Date().toISOString(),
          total_failures: failures.length,
          failures,
        },
        null,
        2,
      ),
      "utf-8",
    );
    logger.warn("Download completed with errors", {
      year,
      quarter,
      exhibitPrefix,
      downloaded: pool.stats.completed,
      failed: pool.stats.failed,
      failureReportPath,
    });
  } else {
    logger.info(`Filing texts ready: total=${filings.length}`);
  }

  return {
    downloaded: pool.stats.completed,
    failed: pool.stats.failed,
    downloadedIds,
    failureReportPath,
  };
}

async function filterDownloadedFilings(
  candidates: FilingRow[],
  downloadedIds: Set<string>,
): Promise<FilingRow[]> {
  if (downloadedIds.size === 0) return [];
  return candidates.filter((filing) => downloadedIds.has(filing.id));
}

async function logProcessingInputDelta(
  year: number,
  quarter: number,
  exhibitPrefix: string,
  candidatesCount: number,
  processCount: number,
) {
  if (candidatesCount !== processCount) {
    logger.warn("Skipping filings missing cached text", {
      year,
      quarter,
      exhibitPrefix,
      candidates: candidatesCount,
      processing: processCount,
      skipped: candidatesCount - processCount,
    });
  }
}

async function handleDownloadStep(
  year: number,
  quarter: number,
  useQuarterSubdir: boolean,
  candidates: FilingRow[],
  exhibitPrefix: string,
): Promise<{ filingsForProcessing: FilingRow[]; downloadResult?: DownloadResult }> {
  const downloadResult = await downloadFilingTexts(
    year,
    quarter,
    useQuarterSubdir,
    candidates,
    exhibitPrefix,
  );
  const filingsForProcessing = await filterDownloadedFilings(
    candidates,
    downloadResult.downloadedIds,
  );
  await logProcessingInputDelta(
    year,
    quarter,
    exhibitPrefix,
    candidates.length,
    filingsForProcessing.length,
  );
  return { filingsForProcessing, downloadResult };
}

async function handleCachedStep(
  year: number,
  quarter: number,
  exhibitPrefix: string,
  candidates: FilingRow[],
): Promise<{ filingsForProcessing: FilingRow[]; downloadResult?: DownloadResult }> {
  logger.info("Reusing cached filing text files", {
    year,
    quarter,
    exhibitPrefix,
  });
  return { filingsForProcessing: candidates, downloadResult: undefined };
}

async function runExhibitRule(
  year: number,
  quarter: number,
  useQuarterSubdir: boolean,
  useCache: boolean,
  skipProcessing: boolean,
  candidates: FilingRow[],
  rule: ExhibitRule,
) {
  const { filingsForProcessing, downloadResult } = !useCache
    ? await handleDownloadStep(
        year,
        quarter,
        useQuarterSubdir,
        candidates,
        rule.exhibitPrefix,
      )
    : await handleCachedStep(year, quarter, rule.exhibitPrefix, candidates);

  if (skipProcessing) {
    logger.info("Skipping processing (--skip-processing flag set)", {
      year,
      quarter,
      exhibitPrefix: rule.exhibitPrefix,
      downloaded: downloadResult?.downloaded ?? candidates.length,
      failedDownloads: downloadResult?.failed ?? 0,
      failureReportPath: downloadResult?.failureReportPath,
    });
    return;
  }

  const { updated, failed } = await processFilings(
    quarter,
    useQuarterSubdir,
    filingsForProcessing,
    rule.exhibitPrefix,
  );
  logger.info("Exhibit job finished", {
    year,
    quarter,
    formPrefix: rule.formPrefix,
    exhibitPrefix: rule.exhibitPrefix,
    updated,
    failed,
    candidates: candidates.length,
    processing: filingsForProcessing.length,
    failedDownloads: downloadResult?.failed ?? 0,
    failureReportPath: downloadResult?.failureReportPath,
  });
}

async function runYearQuarterRule(
  year: number,
  quarter: number,
  useQuarterSubdir: boolean,
  useCache: boolean,
  skipProcessing: boolean,
  rule: ExhibitRule,
) {
  logger.info("Starting exhibit job", {
    year,
    quarter,
    formPrefix: rule.formPrefix,
    exhibitPrefix: rule.exhibitPrefix,
  });
  const candidates = await fetchCandidates(
    year,
    quarter,
    rule.formPrefix,
    rule.exhibitPrefix,
  );
  await runExhibitRule(
    year,
    quarter,
    useQuarterSubdir,
    useCache,
    skipProcessing,
    candidates,
    rule,
  );
}

async function runAllRules(
  years: number[],
  selectedQuarters: number[],
  useQuarterSubdir: boolean,
  useCache: boolean,
  skipProcessing: boolean,
) {
  for (const year of years) {
    for (const quarter of selectedQuarters) {
      for (const rule of EXHIBIT_RULES) {
        await runYearQuarterRule(
          year,
          quarter,
          useQuarterSubdir,
          useCache,
          skipProcessing,
          rule,
        );
      }
    }
  }
}

async function processFilings(
  quarter: number,
  useQuarterSubdir: boolean,
  filings: FilingRow[],
  exhibitPrefix: string,
): Promise<{ updated: number; failed: number }> {
  logger.info(
    `Starting exhibit extraction: filings=${filings.length}, exhibit=${exhibitPrefix}, batchSize=${PROCESS_BATCH_SIZE}`,
  );

  const pool = await runWorkerPool<
    FilingRow,
    { id: string; data: Record<string, unknown> } | null
  >({
    concurrency: PROCESS_CONCURRENCY,
    tasks: filings,
    worker: async (filing) => {
      const cachePath = getCachePath(
        filing,
        exhibitPrefix,
        quarter,
        useQuarterSubdir,
      );
      const body = await fs.readFile(cachePath, "utf-8");

      const exhibits = extractExhibits(body, exhibitPrefix);
      if (exhibits.length === 0) return null;
      const cik = filing.file_url.split("/").slice(-2, -1)[0];
      // start from existing attachments so we don't blow away other exhibit URLs
      const attachments: Record<string, string> = {
        ...(filing.attachments ?? {}),
      };

      exhibits.forEach(({ typeKey, filename }) => {
        const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${filing.accession_number_nodashes}/${filename}`;
        attachments[typeKey] = url;
      });

      const periodOfReport = extractPeriodOfReport(body);
      const updatePayload: Record<string, unknown> = {
        attachments,
        updated_at: new Date().toISOString(),
      };
      if (periodOfReport) updatePayload.period_of_report = periodOfReport;

      return { id: filing.id, data: updatePayload };
    },
    onProgress: (stats) => {
      if (stats.completed % 200 === 0 || stats.completed === stats.total) {
        logger.info(
          `Process progress: completed=${stats.completed}/${stats.total}, remaining=${stats.remaining}`,
        );
      }
    },
    progressInterval: 200,
  });

  const updates = pool.results.filter(
    (u): u is { id: string; data: Record<string, unknown> } => !!u,
  );
  let updated = updates.length;
  let failed = pool.errors.length;

  for (let i = 0; i < updates.length; i += PROCESS_BATCH_SIZE) {
    const batch = updates.slice(i, i + PROCESS_BATCH_SIZE);
    try {
      const ops = batch.map((u) => db.tx.filing[u.id].update({ ...u.data }));
      await db.transact(ops);
      if (
        (i / PROCESS_BATCH_SIZE) % 5 === 0 ||
        i + PROCESS_BATCH_SIZE >= updates.length
      ) {
        logger.info(
          `Persist progress: wrote=${Math.min(i + PROCESS_BATCH_SIZE, updates.length)}/${updates.length}`,
        );
      }
    } catch (error) {
      failed += batch.length;
      logger.error("Failed to persist batch", {
        size: batch.length,
        error: (error as Error).message,
      });
    }
  }

  logger.info(`Extraction complete: updated=${updated}, failed=${failed}`);

  return { updated, failed };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const useCache = hasCliFlag(args, "use-cache");
    const skipProcessing = hasCliFlag(args, "skip-processing");
    
    const { years, quarters: selectedQuarters } = parseYearsAndQuarters(args, [...SEC_QUARTERS]);
    const hasQuarterArg = args.some(
      (arg) => !arg.startsWith("--") && !/^-?\d{4}(,\d{4})*$/.test(arg),
    );
    const useQuarterSubdir = hasQuarterArg;
    
    logger.info("CLI parsed", {
      years,
      quarters: selectedQuarters,
      useQuarterSubdir,
      useCache,
      skipProcessing,
      downloadConcurrency: DOWNLOAD_CONCURRENCY,
    });

    await runAllRules(
      years,
      selectedQuarters,
      useQuarterSubdir,
      useCache,
      skipProcessing,
    );
  } catch (error) {
    const err = error as Error;
    logger.error("Job failed", { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
