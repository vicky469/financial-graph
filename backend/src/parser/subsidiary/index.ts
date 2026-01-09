/**
 * Subsidiary Parser - Main Entry Point
 *
 * Pure parsing functions for SEC Exhibit 21 (10-K) and Exhibit 8 (20-F) files
 * Extracts subsidiary information with hierarchical parent-child relationships
 *
 * Parsing Strategy:
 * 1. Heuristic Table Parser - Extracts structure from HTML tables
 *    - Finds columns via keyword matching
 *    - Analyzes indentation for nesting detection
 *    - Extracts name, jurisdiction, ownership from cells
 *    - Processes all tables in document
 * 
 * 2. LLM Enrichment (optional post-processing) - Fills missing data from footnotes
 *    - Runs after all tables are processed
 *    - Extracts ownership structure (parent-child relationships)
 *    - Extracts ownership percentages
 *    - Matches parent names to existing subsidiary IDs
 */

import { load } from "cheerio";
import { createLogger } from "../../utils/logger";

import type { ParseResult, SubsidiaryRecord } from "./types";
import { extractDocumentFootnotes } from "./footnotes";
import { findHeaderRow, extractHeaders, isLikelyFooterTable } from "./table-detection";
import { extractSubsidiaries } from "./extraction";
import { enrichWithLLM } from "./llm-enrichment";
import { SUBSIDIARY_KEYWORDS, containsAny } from "../../config/subsidiary-keywords";

const logger = createLogger("parsers/subsidiary");

// ============================================================================
// Main Parser Entry Point
// ============================================================================

export async function parseExhibit(
  html: string,
  filing: { accession_number: string; cik: string },
  useLLMEnrichment: boolean = false
): Promise<ParseResult> {

  try {
    // Parse all tables using heuristic approach
    const parseResult = parseTable(html, filing);

    if (parseResult && parseResult.subsidiaries.length > 0) {
      logger.info(
        `[${filing.accession_number}] Heuristic parser succeeded: ${parseResult.subsidiaries.length} subsidiaries (maxNesting: ${parseResult.maxNestingLevel})`
      );
      
      // Post-process: Enrich with LLM after all tables are processed
      if (useLLMEnrichment) {
        logger.info(`[${filing.accession_number}] Starting LLM enrichment...`);
        parseResult.subsidiaries = await enrichWithLLM(
          parseResult.subsidiaries,
          parseResult.footnotes,
          filing.accession_number
        );
      }
      
      return {
        ...parseResult,
        method: useLLMEnrichment ? "LLM" : "Heuristic",
        status: "success",
      };
    }

    // No subsidiaries found (not an error, just empty data)
    logger.info(`[${filing.accession_number}] No subsidiaries found in document`);
    return {
      subsidiaries: [],
      method: "Heuristic",
      status: "empty",
      tableCount: parseResult?.tableCount ?? 0,
      maxNestingLevel: 0,
      footnotes: parseResult?.footnotes ?? {},
    };
  } catch (error: any) {
    // Only catch Cheerio/HTML parsing errors - everything else should fail
    if (error.name === "CheerioError" || error.message?.includes("Invalid HTML")) {
      logger.error(`[${filing.accession_number}] HTML parsing failed: ${error.message}`);
      return {
        subsidiaries: [],
        method: "Failed",
        status: "failed",
        tableCount: 0,
        maxNestingLevel: 0,
        footnotes: {},
        errorMessage: error.message,
      };
    }
    
    // All other errors (ParserError, system errors, etc.) - let them fail
    throw error;
  }
}

// ============================================================================
// Heuristic Table Parser
// ============================================================================

function parseTable(
  html: string,
  filing: { accession_number: string; cik: string }
): Omit<ParseResult, "method" | "status" | "errorMessage"> | null {
  const $ = load(html, { xmlMode: false, decodeEntities: true });
  const tables = $("table");

  if (tables.length === 0) return null;

  // Extract footnotes from the entire document first
  const footnotes = extractDocumentFootnotes($);

  // Process ALL tables (not just those with keywords)
  // We'll filter out non-subsidiary tables during processing
  const allTables: any[] = [];
  tables.each((_: number, tbl: any) => {
    allTables.push($(tbl));
  });

  if (allTables.length === 0) return null;

  // Process all tables and combine subsidiaries
  const allSubsidiaries: SubsidiaryRecord[] = [];
  
  // Track headers and column count from the last successful table for continuation tables
  let lastHeaders: string[] | null = null;
  let lastColumnCount = 0;
  
  for (const table of allTables) {
    const rows = table.find("tr");
    
    // Skip tables with too few rows
    if (rows.length < 2) continue;
    
    const headerRowIndex = findHeaderRow($, rows);

    let headers: string[];
    let startRowIndex: number;

    if (headerRowIndex === -1) {
      // No header row found - could be continuation table or footer
      
      // Check if this looks like a footer table
      if (isLikelyFooterTable($, table)) {
        logger.info(`[${filing.accession_number}] Skipping footer table`);
        continue;
      }
      
      // This is a continuation table
      if (lastHeaders === null) {
        // No previous headers to reuse, skip this table
        logger.debug(`[${filing.accession_number}] Skipping table without headers (no previous headers available)`);
        continue;
      }
      
      // Check if column count matches the previous table
      // Find first non-empty row to count columns (skip width definition rows)
      // Account for colspan attributes
      let currentColumnCount = 0;
      rows.each((_: any, tr: any) => {
        if (currentColumnCount > 0) return false; // Already found
        const $tr = $(tr);
        const cells = $tr.find("td, th");
        // Check if this row has actual content (not just width definitions)
        let hasContent = false;
        let colCount = 0;
        cells.each((_: any, cell: any) => {
          const $cell = $(cell);
          const text = $cell.text().trim();
          if (text.length > 0) {
            hasContent = true;
          }
          // Count colspan
          const colspan = parseInt($cell.attr("colspan") || "1", 10);
          colCount += colspan;
        });
        if (hasContent) {
          currentColumnCount = colCount;
          return false;
        }
      });
      
      // If column count doesn't match and this looks like a footer, skip it
      if (currentColumnCount !== lastColumnCount) {
        if (isLikelyFooterTable($, table)) {
          logger.info(`[${filing.accession_number}] Skipping footer table with mismatched column count (${currentColumnCount} vs ${lastColumnCount})`);
          continue;
        }
        // Otherwise, treat as continuous if we have previous headers
        logger.info(`[${filing.accession_number}] Column count mismatch (${currentColumnCount} vs ${lastColumnCount}), but treating as continuation table`);
      }
      
      // Reuse headers from previous table and start from row 0
      headers = lastHeaders;
      startRowIndex = -1; // Will become rows.slice(0) in extractSubsidiaries
      logger.info(`[${filing.accession_number}] Using previous headers for continuation table (${rows.length} rows)`);
    } else {
      // Header row found - extract headers
      headers = extractHeaders($, rows[headerRowIndex]);
      
      // Check if this table has subsidiary keywords (name + jurisdiction)
      const headerText = headers.join(" ").toLowerCase();
      const hasSubsidiaryKeywords = 
        containsAny(headerText, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) &&
        containsAny(headerText, SUBSIDIARY_KEYWORDS.JURISDICTION);
      
      if (!hasSubsidiaryKeywords) {
        // Not a subsidiary table, skip it
        logger.debug(`[${filing.accession_number}] Skipping table without subsidiary keywords`);
        continue;
      }
      
      // This is a valid subsidiary table - save headers for continuation tables
      // Calculate actual column count with colspan
      const $headerRow = $(rows[headerRowIndex]);
      const headerCells = $headerRow.find("td, th");
      let actualColumnCount = 0;
      headerCells.each((_: any, cell: any) => {
        const colspan = parseInt($(cell).attr("colspan") || "1", 10);
        actualColumnCount += colspan;
      });
      
      startRowIndex = headerRowIndex;
      lastHeaders = headers;
      lastColumnCount = actualColumnCount;
      logger.info(`[${filing.accession_number}] Found subsidiary table with ${rows.length} rows (${actualColumnCount} columns)`);
    }

    const subsidiaries = extractSubsidiaries(
      $,
      rows,
      startRowIndex,
      headers,
      filing,
      footnotes
    );
    
    allSubsidiaries.push(...subsidiaries);
  }

  if (allSubsidiaries.length === 0) return null;

  const maxNestingLevel = Math.max(
    ...allSubsidiaries.map((s) => s.nestingLevel),
    0
  );

  return {
    subsidiaries: allSubsidiaries,
    tableCount: tables.length,
    maxNestingLevel,
    footnotes,
  };
}
