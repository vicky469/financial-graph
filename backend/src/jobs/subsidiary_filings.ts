// Job: Download filing forms and extract EX-21/EX-8 exhibit URLs and period_of_report.
// Steps:
// 1) Fetch candidate filings (by form prefix + year).
// 2) Download TXT bodies (low concurrency for SEC) and store under filing_text dir.
// 3) Read TXT from disk, parse exhibits + period_of_report; batch update attachments in DB.

import { db } from "../db/client";
import { createLogger } from "../utils/logger";
import { getCliArg, hasCliFlag, parseYearsAndQuarters } from "../utils/cli";
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
  form_type?: string;
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
  "filings_failed",
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
    form_type: string;
    source_year?: number;
    source_quarter?: number;
  };
  reason: string;
};

type DownloadResult = {
  downloaded: number;
  failed: number;
  downloadedIds: Set<string>;
  failureReportPath?: string;
};

type RawFailureReport = {
  year?: number;
  quarter?: number;
  form_type?: string;
  exhibit_prefix?: string;
  failures?: Array<{
    input?: {
      id?: string;
      accession_number_nodashes?: string;
      file_url?: string;
      form_type?: string;
      source_year?: number;
      source_quarter?: number;
      exhibit_prefix?: string;
    };
    reason?: string;
  }>;
};

type RetryDownloadTask = {
  id: string;
  accession_number_nodashes: string;
  file_url: string;
  form_type: string;
  source_year: number;
  source_quarter?: number;
  reason?: string;
};

function expandHomePath(inputPath: string): string {
  if (inputPath === "~") {
    return process.env.HOME || inputPath;
  }
  if (inputPath.startsWith("~/")) {
    return path.join(process.env.HOME || "~", inputPath.slice(2));
  }
  return inputPath;
}

function formTypeFromExhibitPrefix(exhibitPrefix?: string): string | undefined {
  if (!exhibitPrefix) return undefined;
  return EXHIBIT_FORM_PREFIX[exhibitPrefix as SubsidiaryExhibit];
}

function extractCikFromFilingUrl(fileUrl: string): string {
  // URL format: .../data/{cik}/{accession}/{file}.txt
  const parts = fileUrl.split("/").filter(Boolean);
  const cik = parts.slice(-2, -1)[0];
  if (!cik) {
    throw new Error(`Unable to infer CIK from file_url: ${fileUrl}`);
  }
  return cik;
}

function buildCachePathForFormType(
  sourceYear: number,
  formType: string,
  accessionNoDashes: string,
  fileUrl: string,
  quarter?: number,
  useQuarterSubdir = false,
): string {
  const cik = extractCikFromFilingUrl(fileUrl);
  const fileName = `${cik}_${accessionNoDashes}.txt`;
  if (useQuarterSubdir && quarter) {
    return path.join(CACHE_ROOT, String(sourceYear), `Q${quarter}`, formType, fileName);
  }
  return path.join(CACHE_ROOT, String(sourceYear), formType, fileName);
}

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

  const formType = EXHIBIT_FORM_PREFIX[exhibitPrefix as SubsidiaryExhibit];
  return buildCachePathForFormType(
    filing.source_year,
    formType,
    filing.accession_number_nodashes,
    filing.file_url,
    quarter,
    useQuarterSubdir,
  );
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
          "form_type",
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
  const formType = EXHIBIT_FORM_PREFIX[exhibitPrefix as SubsidiaryExhibit];
  if (filings.length === 0) {
    return {
      downloaded: 0,
      failed: 0,
      downloadedIds: new Set<string>(),
    };
  }

  await clearCacheDir(year, quarter, useQuarterSubdir, exhibitPrefix);

  logger.info(
    `Downloading filing texts: total=${filings.length}, year=${year}, quarter=${quarter}, form=${formType}, concurrency=${DOWNLOAD_CONCURRENCY}`,
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
        form_type: filing.form_type || formType,
        source_year: filing.source_year,
        source_quarter: quarter,
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
      `download-failures-${year}-Q${quarter}-${formType}-${safeTimestamp}.json`,
    );
    await fs.writeFile(
      failureReportPath,
      JSON.stringify(
        {
          job: "subsidiary_filings",
          year,
          quarter,
          form_type: formType,
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
      formType,
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

async function resolveFailedReportPath(args: string[]): Promise<string> {
  const explicit = getCliArg(args, "failed-report");
  if (explicit) {
    return path.resolve(process.cwd(), expandHomePath(explicit));
  }

  await fs.mkdir(FAILED_REPORT_DIR, { recursive: true });
  const entries = await fs.readdir(FAILED_REPORT_DIR, { withFileTypes: true });
  const reportFiles = entries
    .filter((entry) => entry.isFile() && /^download-failures-.*\.json$/i.test(entry.name))
    .map((entry) => entry.name);

  if (reportFiles.length === 0) {
    throw new Error(
      `No failed download report found in ${FAILED_REPORT_DIR}. Use --failed-report=<path>.`,
    );
  }

  const stats = await Promise.all(
    reportFiles.map(async (name) => {
      const filePath = path.join(FAILED_REPORT_DIR, name);
      const stat = await fs.stat(filePath);
      return { filePath, mtimeMs: stat.mtimeMs };
    }),
  );

  stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return stats[0].filePath;
}

async function loadRetryTasksFromFailedReport(
  reportPath: string,
): Promise<RetryDownloadTask[]> {
  const rawText = await fs.readFile(reportPath, "utf-8");
  const parsed = JSON.parse(rawText) as RawFailureReport;
  const reportFormType =
    parsed.form_type || formTypeFromExhibitPrefix(parsed.exhibit_prefix);

  const tasks: RetryDownloadTask[] = [];
  for (const [index, failure] of (parsed.failures || []).entries()) {
    const input = failure.input || {};
    const accession = input.accession_number_nodashes?.trim();
    const fileUrl = input.file_url?.trim();
    const sourceYearCandidate = Number(input.source_year ?? parsed.year);
    const sourceQuarterCandidate = Number(input.source_quarter ?? parsed.quarter);
    const sourceQuarter =
      Number.isInteger(sourceQuarterCandidate) &&
      sourceQuarterCandidate >= 1 &&
      sourceQuarterCandidate <= 4
        ? sourceQuarterCandidate
        : undefined;
    const formType =
      input.form_type ||
      reportFormType ||
      formTypeFromExhibitPrefix(input.exhibit_prefix);

    if (!accession || !fileUrl) {
      logger.warn("Skipping malformed failed-download entry (missing url/accession)", {
        reportPath,
        entryIndex: index,
      });
      continue;
    }
    if (!Number.isInteger(sourceYearCandidate)) {
      logger.warn("Skipping failed-download entry (missing source year)", {
        reportPath,
        entryIndex: index,
        accession_number_nodashes: accession,
      });
      continue;
    }
    if (!formType) {
      logger.warn("Skipping failed-download entry (missing form_type)", {
        reportPath,
        entryIndex: index,
        accession_number_nodashes: accession,
      });
      continue;
    }

    tasks.push({
      id: input.id || `${sourceYearCandidate}-${accession}`,
      accession_number_nodashes: accession,
      file_url: fileUrl,
      form_type: formType,
      source_year: sourceYearCandidate,
      source_quarter: sourceQuarter,
      reason: failure.reason,
    });
  }

  return tasks;
}

async function retryFailedDownloads(args: string[]): Promise<void> {
  const reportPath = await resolveFailedReportPath(args);
  const useQuarterSubdir = hasCliFlag(args, "quarter-subdir");
  const tasks = await loadRetryTasksFromFailedReport(reportPath);

  if (tasks.length === 0) {
    logger.warn("No valid failed-download entries to retry", { reportPath });
    return;
  }

  logger.info("Retrying failed filing downloads from report", {
    reportPath,
    totalFailures: tasks.length,
    useQuarterSubdir,
    downloadConcurrency: DOWNLOAD_CONCURRENCY,
  });

  const pool = await runWorkerPoolVoid<RetryDownloadTask>({
    tasks,
    concurrency: DOWNLOAD_CONCURRENCY,
    worker: async (task) => {
      const cachePath = buildCachePathForFormType(
        task.source_year,
        task.form_type,
        task.accession_number_nodashes,
        task.file_url,
        task.source_quarter,
        useQuarterSubdir,
      );
      const body = await fetchSecPageWithRetry(task.file_url);
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, body, "utf-8");
    },
    onProgress: (stats) => {
      const done = stats.completed + stats.failed;
      if (done % 25 === 0 || done === stats.total) {
        logger.info(
          `Retry progress: completed=${stats.completed}/${stats.total}, failed=${stats.failed}, remaining=${stats.remaining}`,
        );
      }
    },
    progressInterval: 25,
  });

  const failures: DownloadFailureRecord[] = pool.errors.map(({ task, error }) => {
    const failedTask = task as RetryDownloadTask;
    return {
      input: {
        id: failedTask.id,
        accession_number_nodashes: failedTask.accession_number_nodashes,
        file_url: failedTask.file_url,
        form_type: failedTask.form_type,
        source_year: failedTask.source_year,
        source_quarter: failedTask.source_quarter,
      },
      reason: error.message,
    };
  });

  let retryFailureReportPath: string | undefined;
  if (failures.length > 0) {
    await fs.mkdir(FAILED_REPORT_DIR, { recursive: true });
    const safeTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    retryFailureReportPath = path.join(
      FAILED_REPORT_DIR,
      `retry-download-failures-${safeTimestamp}.json`,
    );
    await fs.writeFile(
      retryFailureReportPath,
      JSON.stringify(
        {
          job: "subsidiary_filings",
          mode: "retry-failed-downloads",
          source_report: reportPath,
          generated_at: new Date().toISOString(),
          total_failures: failures.length,
          failures,
        },
        null,
        2,
      ),
      "utf-8",
    );
  }

  logger.info("Retry failed-download pass complete", {
    reportPath,
    total: tasks.length,
    downloaded: pool.stats.completed,
    failed: pool.stats.failed,
    retryFailureReportPath,
  });
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
    const retryFailedDownloadsMode = hasCliFlag(args, "retry-failed-downloads");
    if (retryFailedDownloadsMode) {
      logger.info("CLI parsed", {
        retryFailedDownloadsMode: true,
        failedReport: getCliArg(args, "failed-report") || "latest",
        useQuarterSubdir: hasCliFlag(args, "quarter-subdir"),
        downloadConcurrency: DOWNLOAD_CONCURRENCY,
      });
      await retryFailedDownloads(args);
      return;
    }

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
