/**
 * Subsidiary Ingestion
 *
 * Orchestrates the ingestion of subsidiary data from SEC filings:
 * 1. Loads cached EX-21 and EX-8 exhibit files
 * 2. Parses HTML to extract subsidiary relationships
 * 3. Outputs to sink (excel, db, or both)
 *
 * Usage:
 *   npm run ingest:subsidiaries                    # Default: excel output
 *   npm run ingest:subsidiaries -- --sink=excel    # Excel only
 *   npm run ingest:subsidiaries -- --sink=db       # InstantDB only
 *   npm run ingest:subsidiaries -- --sink=excel,db # Both
 *   npm run ingest:subsidiaries -- --sink=none     # Dry run (parse only)
 */

import { createLogger } from "../utils/logger";
import { parseExhibit, SubsidiaryRecord } from "../parsers/subsidiary-parser";
import { MissingDBValueError } from "../parsers/subsidiary/errors";
import fs from "fs/promises";
import path from "path";
import { gunzip } from "zlib";
import { promisify } from "util";
import "dotenv/config";

const gunzipAsync = promisify(gunzip);
const logger = createLogger("ingest/subsidiaries");

// ============================================================================
// CLI Arguments
// ============================================================================

type SinkType = "excel" | "db" | "none";

function parseArgs(): { sinks: SinkType[] } {
  const args = process.argv.slice(2);
  const sinkArg = args.find((a) => a.startsWith("--sink="));

  if (!sinkArg) {
    return { sinks: ["excel"] }; // Default
  }

  const sinkValue = sinkArg.replace("--sink=", "");
  const sinks = sinkValue.split(",").map((s) => s.trim()) as SinkType[];

  // Validate
  const validSinks: SinkType[] = ["excel", "db", "none"];
  for (const sink of sinks) {
    if (!validSinks.includes(sink)) {
      logger.error(
        `Invalid sink: ${sink}. Valid options: ${validSinks.join(", ")}`
      );
      process.exit(1);
    }
  }

  return { sinks };
}

// ============================================================================
// Configuration
// ============================================================================

const CONCURRENCY = parseInt(process.env.CONCURRENCY_LOCAL_ANALYSIS!);
const TARGET_YEAR = parseInt(process.env.SEC_YEARS!);
const USE_LLM = process.env.USE_LLM === "true";
const CACHE_BASE_DIR = path.resolve(__dirname, "../data_source/sec/output");

// Exhibit types to process
const EXHIBIT_TYPES = ["EX-21", "EX-8"] as const;
type ExhibitType = (typeof EXHIBIT_TYPES)[number];

// ============================================================================
// Type Definitions
// ============================================================================

interface CachedFile {
  filing: { accession_number: string; cik?: string };
  url: string;
  cachePath: string;
  exhibitType: ExhibitType;
}

interface ParseOutput {
  accession: string;
  exhibitType: ExhibitType;
  url: string;
  method: string;
  success: boolean;
  subsidiaryCount: number;
  maxNestingLevel: number;
  hasNestedStructure: boolean;
  errorMessage?: string;
  subsidiaries: SubsidiaryRecord[];
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const { sinks } = parseArgs();
  const startTime = performance.now();

  logger.info(`Starting Subsidiary Ingestion for Year ${TARGET_YEAR}...`);
  logger.info(
    `Configuration: Concurrency=${CONCURRENCY}, LLM Fallback=${USE_LLM}, Sinks=${sinks.join(
      ","
    )}`
  );

  // Load cached files for all exhibit types
  const allTargets: CachedFile[] = [];
  for (const exhibitType of EXHIBIT_TYPES) {
    const cacheDir = path.join(
      CACHE_BASE_DIR,
      `${exhibitType.toLowerCase()}_${TARGET_YEAR}`
    );
    const targets = await loadCachedFiles(cacheDir, exhibitType);
    allTargets.push(...targets);
    logger.info(`Loaded ${targets.length} ${exhibitType} files`);
  }

  logger.info(`Total files to process: ${allTargets.length}`);

  // Process in batches and collect results
  let processed = 0;
  const results: ParseOutput[] = [];
  const stats = {
    heuristic: 0,
    llm: 0,
    failed: 0,
  };

  for (let i = 0; i < allTargets.length; i += CONCURRENCY) {
    const chunk = allTargets.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(processCachedFiling));

    chunkResults.forEach((result) => {
      processed++;
      results.push(result);

      if (result.success) {
        stats[result.method.toLowerCase() as keyof typeof stats]++;
      } else {
        stats.failed++;
      }
    });

    // Log progress every batch
    logger.info(
      `Progress: ${processed}/${allTargets.length} (${(
        (processed / allTargets.length) *
        100
      ).toFixed(1)}%)`
    );
  }

  const totalTime = performance.now() - startTime;

  // Write outputs based on sink configuration
  if (sinks.includes("excel")) {
    await writeOutputFiles(results);
  }

  if (sinks.includes("db")) {
    // TODO: Implement InstantDB writer
    logger.warn("InstantDB sink not yet implemented");
  }

  if (sinks.includes("none")) {
    logger.info("Dry run - no output written");
  }

  const successful = results.filter((r) => r.success).length;
  const empty = results.filter(
    (r) => r.success && r.subsidiaryCount === 0
  ).length;
  const failed = results.filter((r) => !r.success).length;
  const totalSeconds = (totalTime / 1000).toFixed(2);

  logger.info(
    `Ingestion Complete in ${totalSeconds}s - Total: ${processed}, Success: ${successful}, Empty: ${empty}, Failed: ${failed}, Rate: ${(
      (successful / processed) *
      100
    ).toFixed(1)}%`
  );
}

// ============================================================================
// File Loading
// ============================================================================

async function loadCachedFiles(
  cacheDir: string,
  exhibitType: ExhibitType
): Promise<CachedFile[]> {
  try {
    await fs.access(cacheDir);
  } catch (e) {
    logger.warn(`Cache directory does not exist: ${cacheDir}`);
    return [];
  }

  const files = await fs.readdir(cacheDir);
  const targets: CachedFile[] = [];

  for (const filename of files) {
    if (!filename.endsWith(".htm.gz")) continue;

    const cachePath = path.join(cacheDir, filename);

    // New format: Archives_edgar_data_{cik}_{accession}_{filename}.htm.gz
    const parts = filename.replace(".htm.gz", "").split("_");

    if (
      parts.length >= 6 &&
      parts[0] === "Archives" &&
      parts[1] === "edgar" &&
      parts[2] === "data"
    ) {
      const cik = parts[3];
      const accession = parts[4];
      const pathPart = filename.replace(".gz", "").replace(/_/g, "/");
      const url = `https://www.sec.gov/${pathPart}`;

      targets.push({
        filing: { accession_number: accession, cik },
        url,
        cachePath,
        exhibitType,
      });
    }
  }

  return targets;
}

async function decompressFile(filePath: string): Promise<string> {
  const compressedData = await fs.readFile(filePath);
  const decompressed = await gunzipAsync(compressedData);
  return decompressed.toString("utf-8");
}

// ============================================================================
// Processing Pipeline
// ============================================================================

async function processCachedFiling(target: CachedFile): Promise<ParseOutput> {
  const { filing, url, cachePath, exhibitType } = target;

  // Validate CIK is present
  if (!filing.cik) {
    throw new Error(`CIK is required for filing ${filing.accession_number}`);
  }

  try {
    // 1. Decompress and load HTML
    const html = await decompressFile(cachePath);

    // 2. Parse with multi-strategy approach
    const parseResult = await parseExhibit(
      html,
      filing as { accession_number: string; cik: string },
      USE_LLM
    );

    const success =
      parseResult.method !== "Failed" && parseResult.subsidiaries.length > 0;
    const hasNestedStructure = parseResult.maxNestingLevel > 0;

    return {
      accession: filing.accession_number,
      exhibitType,
      url,
      method: parseResult.method,
      success,
      subsidiaryCount: parseResult.subsidiaries.length,
      maxNestingLevel: parseResult.maxNestingLevel,
      hasNestedStructure,
      errorMessage:
        parseResult.errorMessage ||
        (success ? undefined : "No subsidiaries found"),
      subsidiaries: parseResult.subsidiaries,
    };
  } catch (error) {
    // Add Accession # context to MissingDBValueError while preserving stack trace
    if (error instanceof MissingDBValueError) {
      const enrichedError = new MissingDBValueError(
        error.fieldName,
        (error.context += `accession_number: ${filing.accession_number}`)
      );
      // Preserve the original stack trace
      enrichedError.stack = error.stack;
      throw enrichedError;
    }
    // Re-throw other errors unchanged
    throw error;
  }
}

// ============================================================================
// CSV Output Functions
// ============================================================================

async function writeOutputFiles(results: ParseOutput[]) {
  const outputDir = path.resolve(__dirname, "../../");

  // Split results by category
  const successful = results.filter((r) => r.success && r.subsidiaryCount > 0);
  const empty = results.filter((r) => r.success && r.subsidiaryCount === 0);
  const failed = results.filter((r) => !r.success);

  logger.info(`Writing output files...`);

  // 1. SUCCESS - Detail CSV with all subsidiaries
  if (successful.length > 0) {
    await writeDetailCSV(
      successful,
      path.join(outputDir, "subsidiaries_SUCCESS.csv")
    );
  }

  // 2. EMPTY - Simple CSV with accessions that had no subsidiaries
  if (empty.length > 0) {
    await writeEmptyCSV(empty, path.join(outputDir, "subsidiaries_EMPTY.csv"));
  }

  // 3. FAILED - Excel with error details
  if (failed.length > 0) {
    await writeFailedExcel(
      failed,
      path.join(outputDir, "subsidiaries_FAILED.xlsx")
    );
  }

  logger.info(`Output files written to ${outputDir}`);
}

async function writeDetailCSV(results: ParseOutput[], filePath: string) {
  const header =
    "Accession,URL,SubsidiaryId,Subsidiary,Jurisdiction,NestingLevel,ParentName,ParentId,Ownership,Footnotes\n";

  const rows: string[] = [];

  for (const r of results) {
    for (const sub of r.subsidiaries) {
      const escapedName = `"${sub.name.replace(/"/g, '""')}"`;
      const escapedJur = `"${sub.jurisdiction.replace(/"/g, '""')}"`;
      const escapedParent = sub.parentName
        ? `"${sub.parentName.replace(/"/g, '""')}"`
        : "";
      const parentId = sub.parentId || "";
      const ownership = sub.ownership ?? "";
      const footnotes = `"${sub.footnoteRefs.join(", ")}"`;

      rows.push(
        `"\`${r.accession}","${r.url}",${sub.id},${escapedName},${escapedJur},${sub.nestingLevel},${escapedParent},${parentId},${ownership},${footnotes}`
      );
    }
  }

  await fs.writeFile(filePath, header + rows.join("\n"));
  logger.info(
    `Wrote SUCCESS CSV: ${filePath} (${rows.length} subsidiaries from ${results.length} filings)`
  );
}

async function writeEmptyCSV(results: ParseOutput[], filePath: string) {
  const header = "Accession,URL\n";

  const rows = results.map((r) => `"\`${r.accession}","${r.url}"`).join("\n");

  await fs.writeFile(filePath, header + rows);
  logger.info(
    `Wrote EMPTY CSV: ${filePath} (${results.length} filings with no subsidiaries)`
  );
}

async function writeFailedExcel(results: ParseOutput[], filePath: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Failed");
  sheet.columns = [
    { header: "Accession", key: "accession", width: 20 },
    { header: "URL", key: "url", width: 60 },
    { header: "ErrorMessage", key: "errorMessage", width: 80 },
  ];

  results.forEach((r) => {
    sheet.addRow({
      accession: `\`${r.accession}`,
      url: r.url,
      errorMessage: r.errorMessage || "No subsidiaries found",
    });
  });

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  await workbook.xlsx.writeFile(filePath);
  logger.info(
    `Wrote FAILED Excel: ${filePath} (${results.length} failed filings)`
  );
}

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
  main().catch((error) => {
    logger.error("Fatal error", { error: error.message });
    console.error(error);
    process.exit(1);
  });
}
