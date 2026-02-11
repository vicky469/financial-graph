/**
 * Content Extraction Phase
 *
 * Extracts subsidiary records from tables identified by structure detection.
 * This is the second phase of the two-phase parsing architecture.
 *
 * This module directly produces SubsidiaryRecord[] (the format consumers expect)
 * by reusing the existing extractSubsidiaries() function which has battle-tested
 * column swapping and parsing logic.
 *
 * Receives a shared Cheerio instance ($) from the caller — HTML is parsed once.
 */

import { createLogger } from "../../utils/logger";

import type { TableInfo, ContentExtractionInput } from "./parser-types";
import { ParserError, DocumentClassification } from "./parser-types";
import type { SubsidiaryRecord, ContentExtractionResult } from "./types";
import { extractSubsidiaries } from "./extraction";
import { findHeaderRow, extractHeaders } from "./table-detection";
import { extractDocumentFootnotes } from "./footnotes";
import { preprocessFootnotesHtml } from "./footnotes-preprocessor";

const logger = createLogger("parsers/subsidiary/content-extraction");

// ============================================================================
// Main Content Extraction Function
// ============================================================================

/**
 * Extract subsidiary records from document structure
 *
 * Uses the existing extractSubsidiaries() function which has proper handling for:
 * - Column position swapping (ownership vs jurisdiction)
 * - Multi-year ownership columns
 * - Footnote context and jurisdiction inference
 * - Indentation-based nesting detection
 *
 * @param input - Content extraction input containing structure, $, config, and filing
 * @returns ContentExtractionResult with subsidiaries and metadata
 * @throws ParserError if extraction fails
 */
export function extractSubsidiaryRecords(
  input: ContentExtractionInput,
): ContentExtractionResult {
  const { structure, $, config, filing } = input;

  try {
    logger.debug(
      `[${filing.accession_number}] Starting content extraction for ${structure.classification}`,
    );

    const footnotesHtml = extractFootnotesHtml($, config.processFootnotes);

    // Filter subsidiary tables
    const subsidiaryTables = structure.tables.filter(
      (t) => t.type === "subsidiary",
    );

    if (subsidiaryTables.length === 0) {
      logger.info(
        `[${filing.accession_number}] No subsidiary tables found in structure`,
      );
      return {
        subsidiaries: [],
        maxNestingLevel: 0,
        footnotesHtml,
        tableCount: structure.totalTableCount,
      };
    }

    logger.info(
      `[${filing.accession_number}] Processing ${subsidiaryTables.length} subsidiary tables`,
    );

    const allTables: any[] = [];
    $("table").each((_: number, tbl: any) => {
      allTables.push($(tbl));
    });

    // Process all subsidiary tables and combine results
    const allSubsidiaries: SubsidiaryRecord[] = [];

    for (const tableInfo of subsidiaryTables) {
      logger.debug(
        `[${filing.accession_number}] Processing table ${tableInfo.index} (${tableInfo.isContinuation ? "continuation" : "main"}, ${tableInfo.rowCount} rows)`,
      );

      // Find the table by index in our freshly-parsed DOM
      const $table = allTables[tableInfo.index];
      if (!$table) {
        logger.warn(
          `[${filing.accession_number}] Table ${tableInfo.index} not found in DOM`,
        );
        continue;
      }

      const rows = $table.find("tr");

      // Determine headers to use
      const headers = getHeadersForTable($, rows, tableInfo);
      if (headers.length === 0) {
        logger.debug(
          `[${filing.accession_number}] Table ${tableInfo.index}: No headers available, skipping`,
        );
        continue;
      }

      // Determine start row index
      const headerRowIndex = tableInfo.isContinuation
        ? -1
        : findHeaderRow($, rows);

      // Use the existing extractSubsidiaries function - it has all the proper
      // column swapping, fallback logic, and validation
      const subsidiaries = extractSubsidiaries(
        $,
        rows,
        headerRowIndex,
        headers,
        { ...filing, filingCompanyName: filing.filingCompanyName ?? "" },
      );
      logger.debug(
        `[${filing.accession_number}] Table ${tableInfo.index}: Extracted ${subsidiaries.length} subsidiaries`,
      );

      allSubsidiaries.push(...subsidiaries);
    }

    // Calculate max nesting level
    const maxNestingLevel =
      allSubsidiaries.length > 0
        ? Math.max(...allSubsidiaries.map((s) => s.nestingLevel))
        : 0;

    logger.info(
      `[${filing.accession_number}] Content extraction complete: ${allSubsidiaries.length} subsidiaries (maxNesting: ${maxNestingLevel})`,
    );

    return {
      subsidiaries: allSubsidiaries,
      maxNestingLevel,
      footnotesHtml,
      tableCount: structure.totalTableCount,
    };
  } catch (error: any) {
    logger.error(
      `[${filing.accession_number}] Content extraction failed: ${error.message}`,
    );

    // If it's already a ParserError, re-throw
    if (error instanceof ParserError || error.name === "ParserError") {
      throw error;
    }

    // Wrap other errors
    const errorMessage = `Content extraction failed: ${error.message}`;
    const context = {
      tableCount: structure.totalTableCount,
      classification: structure.classification,
      originalError: error,
    };

    throw new ParserError(errorMessage, "CONTENT_EXTRACTION_ERROR", context);
  }
}

export function extractFootnotesHtml(
  $: any,
  processFootnotes: boolean,
): string {
  if (!processFootnotes) return "";

  const rawFootnotesHtml = extractDocumentFootnotes($);
  return preprocessFootnotesHtml(rawFootnotesHtml);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get headers for a table, handling continuation tables
 */
function getHeadersForTable($: any, rows: any, tableInfo: TableInfo): string[] {
  // For continuation tables, use cached headers from structure detection
  if (tableInfo.isContinuation && tableInfo.cachedHeaders) {
    return tableInfo.cachedHeaders;
  }

  // For regular tables, use headers from structure detection or extract fresh
  if (tableInfo.headers && tableInfo.headers.length > 0) {
    return tableInfo.headers;
  }

  // Fallback: extract headers from the table's header row
  const headerRowIndex = findHeaderRow($, rows);
  if (headerRowIndex >= 0 && rows[headerRowIndex]) {
    return extractHeaders($, rows[headerRowIndex]);
  }

  return [];
}
