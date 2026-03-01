// Job: Convert downloaded filing HTM files to PDF using Playwright.
// Input: output/data/filings_htm/{year}/{formType}/*.htm
// Output: output/data/filings_pdf/{year}/{formType}/*.pdf
//
// CLI:
//   bun run src/jobs/filings_htm_to_pdf.ts -- -2025 10-K
//   bun run src/jobs/filings_htm_to_pdf.ts -- -2025 10-K 20-F
//   bun run src/jobs/filings_htm_to_pdf.ts -- -2025 10-K 20-F --concurrency=6

import fs from "node:fs/promises";
import { availableParallelism, cpus } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getCliIntArg, parseCliYears } from "../utils/cli";
import { createLogger } from "../utils/logger";
import { runWorkerPool } from "../utils/worker-pool";
import { WORKLOAD_PRESETS } from "../utils/workload-config";

const logger = createLogger("jobs/filings_htm_to_pdf");

const HTM_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "data",
  "filings_htm",
);

const PDF_ROOT = path.resolve(
  import.meta.dirname,
  "..",
  "output",
  "data",
  "filings_pdf",
);

type ConversionTask = {
  year: number;
  formType: string;
  htmPath: string;
  pdfPath: string;
};

type PlaywrightPage = {
  goto: (
    url: string,
    options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number },
  ) => Promise<unknown>;
  pdf: (options: {
    path: string;
    format?: "A4" | "Letter";
    printBackground?: boolean;
    preferCSSPageSize?: boolean;
  }) => Promise<unknown>;
  close: () => Promise<void>;
};

type PlaywrightBrowser = {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
};

type PlaywrightChromium = {
  launch: (options?: { headless?: boolean }) => Promise<PlaywrightBrowser>;
};

export function parseFormTypes(args: string[]): string[] {
  return args.filter(
    (arg) => !arg.startsWith("-") && !/^\d{4}$/.test(arg),
  );
}

export function toPdfFilename(htmFilename: string): string {
  if (!htmFilename.toLowerCase().endsWith(".htm")) {
    throw new Error(`Expected .htm filename, received: ${htmFilename}`);
  }
  return `${htmFilename.slice(0, -4)}.pdf`;
}

export function parseRequestedConcurrency(args: string[]): number | undefined {
  const parsed = getCliIntArg(args, "concurrency");
  if (parsed === undefined) return undefined;
  if (parsed < 1) {
    throw new Error(
      `Invalid --concurrency value "${parsed}". Use a positive integer.`,
    );
  }
  return parsed;
}

export function resolveConversionConcurrency(
  taskCount: number,
  requestedConcurrency?: number,
): number {
  if (taskCount <= 0) return 1;
  if (requestedConcurrency !== undefined) {
    return Math.min(taskCount, requestedConcurrency);
  }

  const cpuCount =
    typeof availableParallelism === "function"
      ? availableParallelism()
      : Math.max(1, cpus().length);
  const cpuHint = Math.max(2, Math.min(8, Math.ceil(cpuCount / 2)));
  const workloadHint = WORKLOAD_PRESETS.download(taskCount).concurrency;
  return Math.min(taskCount, Math.max(cpuHint, workloadHint));
}

async function loadChromium(): Promise<PlaywrightChromium> {
  const moduleName = "playwright";
  try {
    const loaded: unknown = await import(moduleName);
    const chromium = (loaded as { chromium?: PlaywrightChromium }).chromium;
    if (!chromium) {
      throw new Error("Missing chromium export from playwright module");
    }
    return chromium;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Playwright is required for HTM->PDF conversion. Install it in backend (bun add playwright). Details: ${message}`,
    );
  }
}

async function collectConversionTasks(
  year: number,
  formType: string,
): Promise<ConversionTask[]> {
  const sourceDir = path.join(HTM_ROOT, String(year), formType);
  try {
    await fs.access(sourceDir);
  } catch {
    logger.warn("HTM source directory not found", { year, formType, sourceDir });
    return [];
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const tasks: ConversionTask[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".htm")) continue;

    const htmPath = path.join(sourceDir, entry.name);
    const pdfPath = path.join(
      PDF_ROOT,
      String(year),
      formType,
      toPdfFilename(entry.name),
    );
    tasks.push({ year, formType, htmPath, pdfPath });
  }

  logger.info("Collected HTM conversion tasks", {
    year,
    formType,
    tasks: tasks.length,
  });
  return tasks;
}

async function convertTask(
  task: ConversionTask,
  browser: PlaywrightBrowser,
): Promise<void> {
  await fs.mkdir(path.dirname(task.pdfPath), { recursive: true });

  const page = await browser.newPage();
  try {
    const fileUrl = pathToFileURL(task.htmPath).href;
    await page.goto(fileUrl, { waitUntil: "load", timeout: 60000 });
    await page.pdf({
      path: task.pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await page.close();
  }
}

async function processFormType(
  browser: PlaywrightBrowser,
  year: number,
  formType: string,
  requestedConcurrency?: number,
): Promise<void> {
  const tasks = await collectConversionTasks(year, formType);
  if (tasks.length === 0) {
    logger.warn("No HTM files found for conversion", { year, formType });
    return;
  }

  const concurrency = resolveConversionConcurrency(
    tasks.length,
    requestedConcurrency,
  );
  logger.info("PDF conversion workload", {
    year,
    formType,
    tasks: tasks.length,
    concurrency,
    requestedConcurrency,
    reasoning:
      requestedConcurrency !== undefined
        ? "user-specified --concurrency"
        : "auto from CPU + download workload",
  });

  const pool = await runWorkerPool<ConversionTask, void>({
    tasks,
    concurrency,
    worker: async (task) => {
      await convertTask(task, browser);
    },
    onProgress: (stats) => {
      if (stats.completed % 20 === 0 || stats.completed === stats.total) {
        logger.info(
          `PDF conversion progress: completed=${stats.completed}/${stats.total}, failed=${stats.failed}, remaining=${stats.remaining}`,
        );
      }
    },
    progressInterval: 20,
  });

  logger.info("PDF conversion complete", {
    year,
    formType,
    successful: pool.stats.completed,
    failed: pool.errors.length,
  });
}

async function main() {
  let browser: PlaywrightBrowser | null = null;
  try {
    const args = process.argv.slice(2);
    const years = parseCliYears(args);
    const formTypes = parseFormTypes(args);
    const requestedConcurrency = parseRequestedConcurrency(args);
    if (formTypes.length === 0) {
      logger.error("No form types specified");
      logger.error(
        "Usage: bun run src/jobs/filings_htm_to_pdf.ts -- -2025 10-K 20-F [--concurrency=6]",
      );
      process.exit(1);
    }

    logger.info("CLI parsed", { years, formTypes, requestedConcurrency });

    const chromium = await loadChromium();
    browser = await chromium.launch({ headless: true });

    for (const year of years) {
      for (const formType of formTypes) {
        await processFormType(browser, year, formType, requestedConcurrency);
      }
    }

    logger.info("Job complete");
  } catch (error) {
    const err = error as Error;
    logger.error("Job failed", { message: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        const err = error as Error;
        logger.warn("Failed to close browser", { message: err.message });
      }
    }
  }
}

if (import.meta.main) {
  main();
}
