/**
 * Subsidiary Ingestion
 *
 * Orchestrates the ingestion of subsidiary data from SEC filings:
 * 1. Loads cached EX-21 and EX-8 exhibit files
 * 2. Parses HTML to extract subsidiary relationships
 * 3. Outputs to CSV files (currently)
 * 4. TODO: Inject to InstantDB
 */

import { createLogger } from "../utils/logger";
import { parseExhibit, SubsidiaryRecord } from "../parsers/subsidiary-parser";
import fs from "fs/promises";
import path from "path";
import { gunzip } from "zlib";
import { promisify } from "util";
import "dotenv/config";

const gunzipAsync = promisify(gunzip);
const logger = createLogger("ingest/subsidiaries");

// Configuration
const CONCURRENCY = parseInt(process.env.CONCURRENCY_LOCAL_ANALYSIS!);
const TARGET_YEAR = parseInt(process.env.SEC_YEARS!);
const USE_LLM_FALLBACK = process.env.USE_LLM_FALLBACK === "true";
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
  const startTime = performance.now();
  logger.info(`Starting Subsidiary Ingestion for Year ${TARGET_YEAR}...`);
  logger.info(
    `Configuration: Concurrency=${CONCURRENCY}, LLM Fallback=${USE_LLM_FALLBACK}`
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

    if (processed % 50 === 0) {
      logger.info(
        `Progress: ${processed}/${allTargets.length} (${(
          (processed / allTargets.length) *
          100
        ).toFixed(1)}%)`
      );
    }
  }

  const totalTime = performance.now() - startTime;

  // Write CSV output files
  await writeOutputFiles(results);

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info("Ingestion Complete", {
    total: processed,
    successful,
    failed,
    heuristic: stats.heuristic,
    llm: stats.llm,
    successRate: `${((successful / processed) * 100).toFixed(1)}%`,
    totalTimeSeconds: (totalTime / 1000).toFixed(2),
  });
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

  try {
    // 1. Decompress and load HTML
    const html = await decompressFile(cachePath);

    // 2. Parse with multi-strategy approach
    const parseResult = await parseExhibit(html, filing, USE_LLM_FALLBACK);

    const success =
      parseResult.method !== "Failed" && parseResult.subsidiaries.length > 0;
    const hasNestedStructure = parseResult.maxNestingLevel > 0;

    if (success) {
      logger.info(
        `[${filing.accession_number}] Success: ${parseResult.subsidiaries.length} subsidiaries (${parseResult.method}, nesting: ${parseResult.maxNestingLevel})`
      );
    } else {
      logger.warn(
        `[${filing.accession_number}] Parsing failed or no subsidiaries found`
      );
    }

    return {
      accession: filing.accession_number,
      exhibitType,
      url,
      method: parseResult.method,
      success,
      subsidiaryCount: parseResult.subsidiaries.length,
      maxNestingLevel: parseResult.maxNestingLevel,
      hasNestedStructure,
      subsidiaries: parseResult.subsidiaries,
    };
  } catch (e: any) {
    logger.error(
      `[${filing.accession_number}] Processing failed: ${e.message}`
    );
    return {
      accession: filing.accession_number,
      exhibitType,
      url,
      method: "Failed",
      success: false,
      subsidiaryCount: 0,
      maxNestingLevel: 0,
      hasNestedStructure: false,
      errorMessage: e.message,
      subsidiaries: [],
    };
  }
}

// ============================================================================
// CSV Output Functions
// ============================================================================

async function writeOutputFiles(results: ParseOutput[]) {
  const outputDir = path.resolve(__dirname, "../../");

  // Split results by category
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const nested = results.filter((r) => r.success && r.hasNestedStructure);

  logger.info(`Writing output files...`);

  // 1. Summary CSV (all results)
  await writeSummaryCSV(
    successful,
    path.join(outputDir, "subsidiary_parsing_SUCCESS.csv")
  );

  if (failed.length > 0) {
    await writeSummaryCSV(
      failed,
      path.join(outputDir, "subsidiary_parsing_FAILED.csv")
    );
  }

  if (nested.length > 0) {
    await writeSummaryCSV(
      nested,
      path.join(outputDir, "subsidiary_parsing_NESTED.csv")
    );
    await writeNestedURLsJSON(
      nested,
      path.join(outputDir, "nested_subsidiaries_urls.json")
    );
  }

  // 2. Flattened CSV (one row per subsidiary)
  await writeFlattenedCSV(
    successful,
    path.join(outputDir, "subsidiaries_flattened_SUCCESS.csv")
  );

  if (failed.length > 0) {
    await writeFlattenedCSV(
      failed,
      path.join(outputDir, "subsidiaries_flattened_FAILED.csv")
    );
  }

  if (nested.length > 0) {
    await writeFlattenedCSV(
      nested,
      path.join(outputDir, "subsidiaries_flattened_NESTED.csv")
    );
  }

  logger.info(`Output files written to ${outputDir}`);
}

async function writeSummaryCSV(results: ParseOutput[], filePath: string) {
  const header =
    "Accession,ExhibitType,URL,Method,Success,SubsidiaryCount,MaxNestingLevel,HasNested,ErrorMessage\n";

  const rows = results
    .map((r) => {
      const escapedUrl = `"${r.url}"`;
      const error = r.errorMessage
        ? `"${r.errorMessage.replace(/"/g, '""')}"`
        : "";
      return `${r.accession},${r.exhibitType},${escapedUrl},${r.method},${r.success},${r.subsidiaryCount},${r.maxNestingLevel},${r.hasNestedStructure},${error}`;
    })
    .join("\n");

  await fs.writeFile(filePath, header + rows);
  logger.info(`Wrote summary CSV: ${filePath} (${results.length} rows)`);
}

async function writeFlattenedCSV(results: ParseOutput[], filePath: string) {
  const header =
    "Accession,ExhibitType,URL,Method,Subsidiary,Jurisdiction,NestingLevel,ParentName,ParentId,Ownership,Footnotes,IsNested\n";

  const rows: string[] = [];

  for (const r of results) {
    if (r.subsidiaries.length === 0) {
      // Write a placeholder row for failed parsing
      if (!r.success) {
        rows.push(
          `${r.accession},${r.exhibitType},"${r.url}",${r.method},"FAILED","","0","","","","","false"`
        );
      }
      continue;
    }

    for (const sub of r.subsidiaries) {
      const escapedName = `"${sub.name.replace(/"/g, '""')}"`;
      const escapedJur = `"${sub.jurisdiction.replace(/"/g, '""')}"`;
      const escapedParent = sub.parentName
        ? `"${sub.parentName.replace(/"/g, '""')}"`
        : "";
      const parentId = sub.parentId || "";
      const ownership = sub.ownership ?? "";
      const footnotes = `"${sub.footnotes.join(", ")}"`;

      rows.push(
        `${r.accession},${r.exhibitType},"${r.url}",${r.method},${escapedName},${escapedJur},${sub.nestingLevel},${escapedParent},${parentId},${ownership},${footnotes},${sub.isNested}`
      );
    }
  }

  await fs.writeFile(filePath, header + rows.join("\n"));
  logger.info(`Wrote flattened CSV: ${filePath} (${rows.length} subsidiaries)`);
}

async function writeNestedURLsJSON(results: ParseOutput[], filePath: string) {
  const nestedFilings = results.map((r) => ({
    accession_number: r.accession,
    exhibit_type: r.exhibitType,
    url: r.url,
    method: r.method,
    subsidiary_count: r.subsidiaryCount,
    nested_subsidiaries_count: r.subsidiaries.filter((s) => s.isNested).length,
    max_nesting_level: r.maxNestingLevel,
    analysis_timestamp: new Date().toISOString(),
  }));

  const output = {
    summary: {
      total_filings_with_nested: results.length,
      total_nested_subsidiaries: results.reduce(
        (sum, r) => sum + r.subsidiaries.filter((s) => s.isNested).length,
        0
      ),
      max_nesting_level_found: Math.max(
        ...results.map((r) => r.maxNestingLevel)
      ),
      generated_at: new Date().toISOString(),
    },
    filings: nestedFilings,
  };

  await fs.writeFile(filePath, JSON.stringify(output, null, 2));
  logger.info(`Wrote nested URLs JSON: ${filePath}`);
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
