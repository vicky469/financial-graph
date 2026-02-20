// Job: Download subsidiary exhibits (EX-21, EX-8) for given years.
// Flow: per year, per exhibit type. Skips if the output folder already has gz files.

import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db/client";
import { createLogger } from "../utils/logger";
import { parseCliQuarters, parseCliYears } from "../utils/cli";
import { runWorkerPool } from "../utils/worker-pool";
import { WORKLOAD_PRESETS } from "../utils/workload-config";
import { fetchSecPageWithRetry, SecFetchMode } from "../integration/sec";
import {
  SUBSIDIARY_EXHIBITS,
  type SubsidiaryExhibit,
} from "../config/subsidiary-exhibits";
import { SEC_QUARTERS } from "../config/config";

const logger = createLogger("jobs/subsidiary_exhibits_download");

const OUTPUT_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "data",
  "subsidiary_exhibits",
);

const PREFIX_FORM_EXHIBIT: Record<SubsidiaryExhibit, string> = {
  "EX-21": "10-K",
  "EX-8": "20-F",
};

type FilingRow = {
  attachments?: Record<string, string>;
};

type DownloadTask = {
  exhibitType: SubsidiaryExhibit;
  year: number;
  quarter?: number;
  url: string;
  destPath: string;
};

function buildDestPath(
  year: number,
  quarter: number | undefined,
  useQuarterSubdir: boolean,
  exhibitType: SubsidiaryExhibit,
  url: string,
): string {
  const urlPath = new URL(url).pathname;
  const parts = urlPath.split("/").filter(Boolean);
  const dataIdx = parts.findIndex((p) => p.toLowerCase() === "data");
  const tail = dataIdx >= 0 ? parts.slice(dataIdx + 1) : parts;
  const relPath = tail.join("/"); // e.g., 1833214/000095017025046994/sabs-ex21_1.htm
  const flatName = `${relPath.replace(/\//g, "_")}.gz`;
  return useQuarterSubdir && quarter
    ? path.join(OUTPUT_ROOT, String(year), `Q${quarter}`, exhibitType, flatName)
    : path.join(OUTPUT_ROOT, String(year), exhibitType, flatName);
}

async function fetchExhibits(
  year: number,
  quarter: number | undefined,
  exhibitType: SubsidiaryExhibit,
): Promise<FilingRow[]> {
  const formPrefix = PREFIX_FORM_EXHIBIT[exhibitType];
  const res = await db.query({
    filing: {
      $: {
        where: {
          source_year: year,
          ...(quarter ? { source_quarter: quarter } : {}),
          form_type: { $like: `${formPrefix}%` },
        },
        fields: ["attachments"],
        limit: 200000,
      },
    },
  });
  const rows = (res.filing || []) as FilingRow[];

  // Keep only attachments relevant to this exhibit type
  const filtered = rows.map((row) => {
    const attachments = row.attachments || {};
    const kept: Record<string, string> = {};
    for (const [k, v] of Object.entries(attachments)) {
      if (k.toUpperCase().startsWith(exhibitType) && v) {
        kept[k] = v;
      }
    }
    return { ...row, attachments: kept };
  });

  logger.info("Fetched filings", {
    year,
    quarter,
    exhibitType,
    count: filtered.length,
  });
  return filtered;
}

function collectDownloadTasks(
  year: number,
  quarter: number | undefined,
  useQuarterSubdir: boolean,
  filings: FilingRow[],
  exhibitType: SubsidiaryExhibit,
): DownloadTask[] {
  const tasks: DownloadTask[] = [];
  const prefix = exhibitType; // attachments use the exhibit type as prefix

  for (const filing of filings) {
    const attachments = filing.attachments || {};
    for (const [key, url] of Object.entries(attachments)) {
      if (!url) continue;
      if (!key.startsWith(prefix)) continue;
      tasks.push({
        exhibitType,
        year,
        quarter,
        url,
        destPath: buildDestPath(year, quarter, useQuarterSubdir, exhibitType, url),
      });
    }
  }

  logger.info("Collected exhibit tasks", {
    year,
    quarter,
    exhibitType,
    tasks: tasks.length,
  });
  return tasks;
}

async function downloadTask(task: DownloadTask): Promise<void> {
  const isPDF = task.url.toLowerCase().endsWith(".pdf");

  const content = isPDF
    ? await fetchSecPageWithRetry(task.url, SecFetchMode.PDF)
    : await fetchSecPageWithRetry(task.url, SecFetchMode.TEXT);
  const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;

  await fs.mkdir(path.dirname(task.destPath), { recursive: true });
  const gz = await import("node:zlib").then((z) => z.gzipSync(buffer));
  await fs.writeFile(task.destPath, gz);
}

async function processExhibitType(
  year: number,
  quarter: number | undefined,
  useQuarterSubdir: boolean,
  exhibitType: SubsidiaryExhibit,
  filings: FilingRow[],
): Promise<void> {
  const tasks = collectDownloadTasks(
    year,
    quarter,
    useQuarterSubdir,
    filings,
    exhibitType,
  );
  if (tasks.length === 0) {
    logger.info(`No ${exhibitType} tasks for ${year}${quarter ? ` Q${quarter}` : ""}`);
    return;
  }

  const workload = WORKLOAD_PRESETS.secApi(tasks.length);
  logger.info("Download workload", {
    year,
    quarter,
    exhibitType,
    tasks: tasks.length,
    concurrency: workload.concurrency,
    reasoning: workload.reasoning,
  });

  const pool = await runWorkerPool<DownloadTask, void>({
    tasks,
    concurrency: workload.concurrency,
    worker: downloadTask,
    onProgress: (stats) => {
      if (stats.completed % 200 === 0 || stats.completed === stats.total) {
        logger.info(
          `Progress ${exhibitType} completed=${stats.completed} total=${stats.total} remaining=${stats.remaining}`,
        );
      }
    },
    progressInterval: 200,
  });

  if (pool.errors.length > 0) {
    logger.warn("Completed with download errors", {
      year,
      quarter,
      exhibitType,
      errors: pool.errors.length,
    });
  } else {
    logger.info(
      `Completed ${exhibitType} downloads for ${year}${quarter ? ` Q${quarter}` : ""}`,
    );
  }
}

async function processYear(
  year: number,
  selectedQuarters: number[],
  useQuarterSubdir: boolean,
): Promise<void> {
  if (!useQuarterSubdir) {
    for (const exhibitType of SUBSIDIARY_EXHIBITS) {
      const base = path.join(OUTPUT_ROOT, String(year), exhibitType);
      try {
        const entries = await fs.readdir(base);
        if (entries.some((e) => e.endsWith(".gz"))) {
          logger.info(`Skipping ${exhibitType} for ${year}: existing gz files`, {
            base,
          });
          continue;
        }
      } catch {
        // missing dir is fine
      }
      logger.info(`Processing ${exhibitType} for ${year}`);
      const filings = await fetchExhibits(year, undefined, exhibitType);
      await processExhibitType(year, undefined, false, exhibitType, filings);
    }
    return;
  }

  for (const quarter of selectedQuarters) {
    for (const exhibitType of SUBSIDIARY_EXHIBITS) {
      const base = path.join(OUTPUT_ROOT, String(year), `Q${quarter}`, exhibitType);
      try {
        const entries = await fs.readdir(base);
        if (entries.some((e) => e.endsWith(".gz"))) {
          logger.info(
            `Skipping ${exhibitType} for ${year} Q${quarter}: existing gz files`,
            { base },
          );
          continue;
        }
      } catch {
        // missing dir is fine
      }
      logger.info(`Processing ${exhibitType} for ${year} Q${quarter}`);
      const filings = await fetchExhibits(year, quarter, exhibitType);
      await processExhibitType(year, quarter, true, exhibitType, filings);
    }
  }
}

export async function main() {
  try {
    const years = parseCliYears(process.argv[2]);
    const quarterArg = process.argv.slice(3).join(",");
    const selectedQuarters = quarterArg
      ? parseCliQuarters(quarterArg)
      : [...SEC_QUARTERS];
    const useQuarterSubdir = quarterArg.length > 0;

    logger.info("CLI parsed", {
      years,
      quarters: selectedQuarters,
      useQuarterSubdir,
    });

    for (const year of years) {
      await processYear(year, selectedQuarters, useQuarterSubdir);
    }
    logger.info("subsidiary_exhibits_download finished");
    process.exit(0);
  } catch (error) {
    const err = error as Error;
    logger.error("Job failed", { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
