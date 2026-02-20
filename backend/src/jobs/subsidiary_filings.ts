// Job: Download filing forms and extract EX-21/EX-8 exhibit URLs and period_of_report.
// Steps:
// 1) Fetch candidate filings (by form prefix + year).
// 2) Download TXT bodies (low concurrency for SEC) and store under filing_text dir.
// 3) Read TXT from disk, parse exhibits + period_of_report; batch update attachments in DB.

import { db } from "../db/client";
import { createLogger } from "../utils/logger";
import { hasCliFlag, parseYearsAndQuarters } from "../utils/cli";
import { fetchSecPageWithRetry } from "../integration/sec";
import { runWorkerPool } from "../utils/worker-pool";
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

// Tunables
const DOWNLOAD_CONCURRENCY = 2; // SEC-friendly
const PROCESS_BATCH_SIZE = 200;
const PROCESS_CONCURRENCY = 6;

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
): Promise<void> {
  if (filings.length === 0) return;

  await clearCacheDir(year, quarter, useQuarterSubdir, exhibitPrefix);

  logger.info(
    `Downloading filing texts: total=${filings.length}, year=${year}, quarter=${quarter}, concurrency=${DOWNLOAD_CONCURRENCY}, exhibit=${exhibitPrefix}`,
  );

  let completed = 0;
  for (const filing of filings) {
    const cachePath = getCachePath(
      filing,
      exhibitPrefix,
      quarter,
      useQuarterSubdir,
    );
    const body = await fetchSecPageWithRetry(filing.file_url);
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, body, "utf-8");
    completed += 1;
    if (completed % 50 === 0 || completed === filings.length) {
      logger.info(
        `Download progress: completed=${completed}/${filings.length}, remaining=${filings.length - completed}`,
      );
    }
  }

  logger.info(`Filing texts ready: total=${filings.length}`);
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
    });

    for (const year of years) {
      for (const quarter of selectedQuarters) {
        for (const rule of EXHIBIT_RULES) {
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
          if (!useCache) {
            await downloadFilingTexts(
              year,
              quarter,
              useQuarterSubdir,
              candidates,
              rule.exhibitPrefix,
            );
          } else {
            logger.info("Reusing cached filing text files", {
              year,
              quarter,
              exhibitPrefix: rule.exhibitPrefix,
            });
          }
          
          if (skipProcessing) {
            logger.info("Skipping processing (--skip-processing flag set)", {
              year,
              quarter,
              exhibitPrefix: rule.exhibitPrefix,
            });
          } else {
            const { updated, failed } = await processFilings(
              quarter,
              useQuarterSubdir,
              candidates,
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
            });
          }
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Job failed", { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
