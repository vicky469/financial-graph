/**
 * Subsidiary Ingestion
 *
 * Orchestrates the ingestion of subsidiary data from SEC filings:
 * 1. Loads cached EX-21 and EX-8 exhibit files
 * 2. Parses HTML to extract subsidiary relationships (heuristic only)
 * 3. Outputs to sink (excel, db, or both)
 * 4. Reports count of subsidiaries needing LLM enrichment
 *
 * Usage:
 *   bun run ingest:subsidiaries                              # Default: all exhibits, excel output
 *   bun run ingest:subsidiaries -- --sink=excel              # Excel only
 *   bun run ingest:subsidiaries -- --sink=db                 # InstantDB only
 *   bun run ingest:subsidiaries -- --sink=excel,db           # Both
 *   bun run ingest:subsidiaries -- --sink=none               # Dry run (parse only)
 *   bun run ingest:subsidiaries -- --limit=10                # Process only first 10 files
 */

import { createLogger } from "../utils/logger";
import {
  parseExhibitRefactored,
  ParserError,
} from "../parser/subsidiary";
import type { SubsidiaryRecord } from "../parser/subsidiary/types";
import { MissingDBValueError } from "../parser/subsidiary/errors";
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

function parseArgs(): { sinks: SinkType[]; limit?: number; accessions?: string[] } {
  const args = process.argv.slice(2);
  
  // Parse sink argument
  const sinkArg = args.find((a) => a.startsWith("--sink="));
  let sinks: SinkType[] = ["excel"]; // Default

  if (sinkArg) {
    const sinkValue = sinkArg.replace("--sink=", "");
    sinks = sinkValue.split(",").map((s) => s.trim()) as SinkType[];

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
  }

  // Parse limit argument
  const limitArg = args.find((a) => a.startsWith("--limit="));
  let limit: number | undefined;

  if (limitArg) {
    limit = parseInt(limitArg.replace("--limit=", ""));
    if (isNaN(limit) || limit <= 0) {
      logger.error(`Invalid limit: ${limitArg}. Must be a positive number.`);
      process.exit(1);
    }
  }

  // Parse accessions argument
  const accessionsArg = args.find((a) => a.startsWith("--accessions="));
  let accessions: string[] | undefined;

  if (accessionsArg) {
    const accessionsValue = accessionsArg.replace("--accessions=", "");
    accessions = accessionsValue.split(",").map((s) => s.trim()).filter(Boolean);
    
    if (accessions.length === 0) {
      logger.error(`Invalid accessions: ${accessionsArg}. Must be a comma-separated list of accession numbers.`);
      process.exit(1);
    }
    
    logger.info(`Filtering to specific accessions: ${accessions.join(", ")}`);
  }

  return { sinks, limit, accessions };
}

// ============================================================================
// Configuration
// ============================================================================

const CONCURRENCY = parseInt(process.env.CONCURRENCY_LOCAL_ANALYSIS!);
const TARGET_YEAR = parseInt(process.env.SEC_YEARS!);
const CACHE_BASE_DIR = path.resolve(__dirname, "../data_source/sec/output");

// Exhibit types to process
const EXHIBIT_TYPES = ["EX-21", "EX-8"] as const;
type ExhibitType = (typeof EXHIBIT_TYPES)[number];

// ============================================================================
// Type Definitions
// ============================================================================

interface CachedFilePreFilter {
  filing: { accession_number: string; cik?: string };
  url: string;
  cachePath: string;
  exhibitType: ExhibitType;
}

interface CachedFile extends CachedFilePreFilter {
  filingCompanyId: string; // Company ID from database (required - must be set during filtering)
  filingCompanyName?: string; // Company name from database (optional, for parser context)
}

interface ParseOutput {
  accession: string;
  cik?: string;
  exhibitType: ExhibitType;
  url: string;
  method: string;
  success: boolean;
  subsidiaryCount: number;
  maxNestingLevel: number;
  hasNestedStructure: boolean;
  errorMessage?: string;
  subsidiaries: SubsidiaryRecord[];
  footnotesHtml?: string; // Preprocessed footnotes HTML for LLM enrichment
}

// ============================================================================
// Preprocess Functions
// ============================================================================

/**
 * Preprocess cached files: validate they exist in DB and enrich with company_id and company_name
 * Uses CIK lookup cache for efficient company_id resolution
 * Note: Assumes CIK lookup cache is already loaded
 */
async function preprocessCachedFiles(targets: CachedFilePreFilter[]): Promise<CachedFile[]> {
  const { db } = await import("../db/client");
  const { lookupCompanyIdByCik } = await import("../db/queries/cik-lookup");
  
  logger.info(`Preprocessing ${targets.length} cached files...`);
  
  // Get all unique company IDs from CIK lookup
  const companyIds = new Set<string>();
  const targetWithCompanyId: Array<{ target: CachedFilePreFilter; companyId: string }> = [];
  
  for (const target of targets) {
    if (!target.filing.cik) {
      logger.debug(`[${target.filing.accession_number}] No CIK available - skipping`);
      continue;
    }
    
    // Normalize CIK to 10 digits
    const normalizedCik = target.filing.cik.padStart(10, '0');
    const companyId = lookupCompanyIdByCik(normalizedCik);
    
    if (!companyId) {
      logger.debug(`[${target.filing.accession_number}] Company not found for CIK ${normalizedCik} - skipping`);
      continue;
    }
    
    companyIds.add(companyId);
    targetWithCompanyId.push({ target, companyId });
  }
  
  logger.info(`Found ${companyIds.size} unique companies from ${targetWithCompanyId.length} files`);
  
  // Fetch company names from database
  const companyNames = new Map<string, string>();
  if (companyIds.size > 0) {
    const companies = await db.query({
      company: {
        $: {
          where: {
            id: { in: Array.from(companyIds) },
          },
        },
      },
    });
    
    for (const company of companies.company || []) {
      companyNames.set(company.id, company.name);
    }
    
    logger.info(`Fetched names for ${companyNames.size} companies`);
  }
  
  // Add the company ID and name to create complete CachedFile records
  // Note: CIK lookup is only for public companies, so no need to verify company type
  const validTargets: CachedFile[] = targetWithCompanyId.map(({ target, companyId }) => ({
    ...target,
    filingCompanyId: companyId,
    filingCompanyName: companyNames.get(companyId),
  }));
  
  const noCik = targets.length - targetWithCompanyId.length;
  
  logger.info(`Preprocessing results: ${validTargets.length} valid, ${noCik} no CIK`);
  
  return validTargets;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  const { sinks, limit, accessions } = parseArgs();
  const startTime = performance.now();

  logger.info(`Starting Subsidiary Ingestion for Year ${TARGET_YEAR}...`);
  logger.info(
    `Configuration: Concurrency=${CONCURRENCY}, Sinks=${sinks.join(
      ","
    )}${limit ? `, Limit=${limit}` : ""}${accessions ? `, Accessions=${accessions.length}` : ""}`
  );

  // Load CIK lookup cache once at startup
  const { loadCikLookupCache } = await import("../db/queries/cik-lookup");
  await loadCikLookupCache();
  logger.info("CIK lookup cache loaded");

  // Load cached files from all exhibit type directories
  let preFilterTargets: CachedFilePreFilter[] = [];

  for (const exhibitType of EXHIBIT_TYPES) {
    const cacheDir = path.join(
      CACHE_BASE_DIR,
      `${exhibitType.toLowerCase()}_${TARGET_YEAR}`
    );
    const targets = await loadCachedFiles(cacheDir, exhibitType);
    preFilterTargets.push(...targets);
    logger.info(`Loaded ${targets.length} ${exhibitType} files`);
  }

  // Apply accessions filter if specified
  if (accessions && accessions.length > 0) {
    const originalCount = preFilterTargets.length;
    preFilterTargets = preFilterTargets.filter(target => 
      accessions.includes(target.filing.accession_number)
    );
    logger.info(`Filtered to ${preFilterTargets.length} files matching specified accessions (from ${originalCount} total)`);
    
    // Log which accessions were found and which were missing
    const foundAccessions = preFilterTargets.map(t => t.filing.accession_number);
    const missingAccessions = accessions.filter(acc => !foundAccessions.includes(acc));
    
    if (foundAccessions.length > 0) {
      logger.info(`Found accessions: ${foundAccessions.join(", ")}`);
    }
    
    if (missingAccessions.length > 0) {
      logger.warn(`Missing accessions (not found in cache): ${missingAccessions.join(", ")}`);
    }
  }

  // Apply limit if specified (after accessions filter)
  if (limit && limit < preFilterTargets.length) {
    preFilterTargets = preFilterTargets.slice(0, limit);
    logger.info(`Limited to first ${limit} files`);
  }

  logger.info(`Total files to process: ${preFilterTargets.length}`);

  // Preprocess: validate filings exist in DB and enrich with company_id
  const allTargets = await preprocessCachedFiles(preFilterTargets);
  const skippedCount = preFilterTargets.length - allTargets.length;
  
  if (skippedCount > 0) {
    logger.info(`Filtered out ${skippedCount} filings (not in DB or not public companies)`);
  }
  
  logger.info(`Files to process after preprocessing: ${allTargets.length}`);

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

    // Calculate cumulative subsidiary count
    const totalSubsidiaries = results.reduce((sum, r) => sum + r.subsidiaryCount, 0);
    const successfulFilings = stats.heuristic + stats.llm;

    // Log progress every batch
    logger.info(
      `Progress: ${processed}/${allTargets.length} filings (${(
        (processed / allTargets.length) *
        100
      ).toFixed(1)}%) | ${successfulFilings} successful | ${totalSubsidiaries} subsidiaries extracted`
    );
  }

  const totalTime = performance.now() - startTime;

  // Write outputs based on sink configuration
  if (sinks.includes("excel")) {
    await writeOutputFiles(results);
  }

  let enrichmentRecords = 0;
  if (sinks.includes("db")) {
    const { writeSubsidiariesToDB } = await import("./subsidiaries-db");
    const { created, errors, enrichmentRecords: enrichmentCount } = await writeSubsidiariesToDB(results);
    enrichmentRecords = enrichmentCount;
    logger.info(
      `InstantDB: wrote ${created} subsidiaries, ${enrichmentRecords} enrichment records (${errors} errors)`
    );
  }

  if (sinks.includes("none")) {
    logger.info("Dry run - no output written");
  }

  const successful = results.filter((r) => r.success).length;
  const empty = results.filter(
    (r) => r.success && r.subsidiaryCount === 0
  ).length;
  const failed = results.filter((r) => !r.success).length;
  const withSubsidiaries = successful - empty;
  const totalSubsidiaries = results.reduce((sum, r) => sum + r.subsidiaryCount, 0);
  const totalSeconds = (totalTime / 1000).toFixed(2);

  const successFailureRate = ((successful / processed) * 100).toFixed(1);
  const successEmptyRate =
    successful > 0 ? ((withSubsidiaries / successful) * 100).toFixed(1) : "0.0";

  logger.info(
    `Ingestion Complete in ${totalSeconds}s - Filings: ${processed} total, ${withSubsidiaries} with subsidiaries, ${empty} empty, ${failed} failed | Subsidiaries: ${totalSubsidiaries} extracted | Success Rate: ${successFailureRate}%`
  );

  // Report count of subsidiaries needing enrichment
  if (enrichmentRecords > 0) {
    logger.info(
      `Enrichment needed: ${enrichmentRecords} subsidiaries with footnotes require LLM enrichment`
    );
  }
}

// ============================================================================
// File Loading
// ============================================================================

async function loadCachedFiles(
  cacheDir: string,
  exhibitType: ExhibitType
): Promise<CachedFilePreFilter[]> {
  try {
    await fs.access(cacheDir);
  } catch (e) {
    logger.warn(`Cache directory does not exist: ${cacheDir}`);
    return [];
  }

  const files = await fs.readdir(cacheDir);
  const targets: CachedFilePreFilter[] = [];

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
  const { filing, url, cachePath, exhibitType, filingCompanyId, filingCompanyName } = target;

  // Validate required fields
  if (!filing.cik) {
    throw new Error(`CIK is required for filing ${filing.accession_number}`);
  }
  
  if (!filingCompanyId) {
    throw new Error(`filingCompanyId is required for filing ${filing.accession_number} - must be set during filtering`);
  }

  // Normalize CIK to 10 digits with leading zeros (SEC standard format)
  const normalizedCik = filing.cik.padStart(10, '0');

  try {
    // 1. Decompress and load HTML
    const html = await decompressFile(cachePath);

    // 2. Parse with refactored two-phase parser (returns ParseResult directly)
    const result = await parseExhibitRefactored(
      html,
      { accession_number: filing.accession_number, cik: normalizedCik, filingCompanyId },
    );

    const success = result.status === "success" || result.status === "empty";
    const hasNestedStructure = result.maxNestingLevel > 0;

    return {
      accession: filing.accession_number,
      cik: normalizedCik,
      exhibitType,
      url,
      method: result.method,
      success,
      subsidiaryCount: result.subsidiaries.length,
      maxNestingLevel: result.maxNestingLevel,
      hasNestedStructure,
      errorMessage: result.errorMessage,
      subsidiaries: result.subsidiaries,
      footnotesHtml: result.footnotesHtml,
    };
  } catch (error) {
    // Handle ParserError
    if (error instanceof ParserError) {
      logger.error(
        `[${filing.accession_number}] ParserError: ${error.message}`
      );
      return {
        accession: filing.accession_number,
        cik: filing.cik,
        exhibitType,
        url,
        method: "failed",
        success: false,
        subsidiaryCount: 0,
        maxNestingLevel: 0,
        hasNestedStructure: false,
        errorMessage: error.message,
        subsidiaries: [],
      };
    }
    
    // Add Accession # context to MissingDBValueError while preserving stack trace
    if (error instanceof MissingDBValueError) {
      logger.error(
        `[${filing.accession_number}] MissingDBValueError: ${error.message}`
      );
      return {
        accession: filing.accession_number,
        cik: filing.cik,
        exhibitType,
        url,
        method: "failed",
        success: false,
        subsidiaryCount: 0,
        maxNestingLevel: 0,
        hasNestedStructure: false,
        errorMessage: error.message,
        subsidiaries: [],
      };
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
      errorMessage: r.errorMessage || "Unknown error",
    });
  });

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
