/**
 * Structure Detection Phase
 * 
 * Simplified version that focuses on the essential task:
 * 1. Find tables with subsidiary keywords in headers
 * 2. Detect text-based subsidiary listings
 * 3. Return a simple structure description
 */

import * as cheerio from 'cheerio';
type CheerioAPI = ReturnType<typeof cheerio.load>;

import { createLogger } from "../../utils/logger";

import type {
  DocumentStructure,
  DocumentClassification,
  TableInfo,
  ParserConfig,
} from "./types-refactored";
import { ParserError } from "./types-refactored";
import {
  findHeaderRow,
  extractHeaders,
  isLikelyFooterTable,
} from "./table-detection";
import { SUBSIDIARY_KEYWORDS, containsAny } from "../../config/subsidiary-keywords";

const logger = createLogger("parsers/subsidiary/structure-detection");

// ============================================================================
// Main Structure Detection Function (Simplified)
// ============================================================================

/**
 * Detect and analyze document structure:
 * 1. Check for text-based subsidiaries first
 * 2. Find tables with subsidiary keywords in headers
 * 3. Return basic structure info
 * 
 * @param html - HTML content to parse
 * @param config - Parser configuration
 * @returns DocumentStructure describing the detected structure
 * @throws ParserError if HTML parsing fails
 */
export function detectDocumentStructure(
  html: string,
  config: ParserConfig
): DocumentStructure {
  try {
    // Parse HTML with Cheerio
    const $ = cheerio.load(html, { xmlMode: false, decodeEntities: true });
    
    logger.debug("Starting structure detection");

    // Step 1: Check for text-based subsidiary listings first
    const textBasedInfo = detectTextBasedSubsidiaries($);
    if (textBasedInfo && textBasedInfo.entryCount > 0) {
      logger.debug(`Found text-based subsidiary listing with ${textBasedInfo.entryCount} entries`);
      return {
        classification: "text-based",
        tables: [],
        totalTableCount: 0,
        textBased: textBasedInfo,
      };
    }

    // Step 2: Find all tables
    const tables = $("table");
    logger.debug(`Found ${tables.length} tables in document`);

    if (tables.length === 0) {
      logger.debug("No tables found - document is empty");
      return {
        classification: "no-table",
        tables: [],
        totalTableCount: 0,
      };
    }

    // Step 3: Process tables to find subsidiary tables
    const allTableInfos = processAllTables($, tables);
    const subsidiaryTables = allTableInfos.filter((t) => t.type === "subsidiary");

    // Step 4: Determine classification
    const classification = classifyDocument(subsidiaryTables);

    logger.debug(`Final classification: ${classification}, ${subsidiaryTables.length} subsidiary tables`);

    return {
      classification,
      tables: allTableInfos,
      totalTableCount: tables.length,
    };

  } catch (error: any) {
    logger.error(`Structure detection failed: ${error.message}`);
    
    // Catch Cheerio parsing errors and throw ParserError
    if (error.name === "CheerioError" || error.message?.includes("Invalid HTML")) {
      throw new ParserError(
        `HTML parsing failed: ${error.message}`,
        "HTML_PARSE_ERROR",
        { originalError: error }
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// ============================================================================
// Helper Functions (Simplified)
// ============================================================================

/**
 * Detect text-based subsidiary listings in HTML (SIMPLIFIED)
 * 
 * Looks for patterns like:
 * - Company Name (Jurisdiction)
 * - Company Name - Jurisdiction
 * 
 * @param $ - Cheerio instance
 * @returns TextBasedInfo if text-based subsidiaries found, null otherwise
 */
function detectTextBasedSubsidiaries($: CheerioAPI): import("./types-refactored").TextBasedInfo | null {
  const candidateElements: any[] = [];
  
  // Look for div or p elements that might contain subsidiary information
  $("div, p").each((_: number, element: any) => {
    const $element = $(element);
    const text = $element.text().trim();
    
    // Skip empty or very short text
    if (text.length < 5) return;
    
    // Skip headers/titles
    if (isHeaderOrTitle(text)) return;
    
    // Look for patterns that suggest subsidiary information
    if (isSubsidiaryPattern(text)) {
      candidateElements.push($element);
    }
  });
  
  // Need at least 2 entries to consider it a subsidiary list
  if (candidateElements.length >= 2) {
    logger.debug(`Found ${candidateElements.length} text-based subsidiary entries`);
    return {
      elements: candidateElements,
      entryCount: candidateElements.length,
    };
  }
  
  return null;
}

/**
 * Check if text matches subsidiary patterns (SIMPLIFIED)
 */
function isSubsidiaryPattern(text: string): boolean {
  // Pattern 1: Text ending with (Country/State)
  if (/\([^)]+\)\s*$/.test(text)) {
    return true;
  }
  
  // Pattern 2: Text with dash separator (Company - Country)
  if (/\s-\s/.test(text)) {
    return true;
  }
  
  // Pattern 3: Text with comma separator (Company, Country)
  if (/,\s+[A-Z]/.test(text)) {
    return true;
  }
  
  // Pattern 4: Text containing common business entity suffixes
  const entitySuffixes = ['LLC', 'Inc', 'Corp', 'Ltd', 'Limited', 'Company', 'GmbH', 'S.A.'];
  const upperText = text.toUpperCase();
  
  return entitySuffixes.some(suffix => upperText.includes(suffix));
}

/**
 * Check if text is likely a header or title (should be excluded)
 */
function isHeaderOrTitle(text: string): boolean {
  const upperText = text.toUpperCase();
  
  // Common header patterns
  const headerPatterns = [
    'EXHIBIT',
    'SUBSIDIARIES OF',
    'LIST OF SUBSIDIARIES',
    'SUBSIDIARY COMPANIES',
    'SIGNIFICANT SUBSIDIARIES',
    'SUBSIDIARIES LIST',
  ];
  
  return headerPatterns.some(pattern => upperText.includes(pattern));
}

/**
 * Calculate column count from table rows (accounting for colspan)
 */
function calculateColumnCount(
  $: CheerioAPI,
  rows: any
): number {
  let columnCount = 0;

  rows.each((_: number, tr: any) => {
    if (columnCount > 0) return false; // Already found

    const $tr = $(tr);
    const cells = $tr.find("td, th");

    // Check if this row has actual content (not just width definitions)
    let hasContent = false;
    let colCount = 0;

    cells.each((_: number, cell: any) => {
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
      columnCount = colCount;
      return false; // Stop iteration
    }
  });

  return columnCount;
}

// ============================================================================
// Step 3: Process All Tables (Extracted Method)
// ============================================================================

/**
 * Process all tables to identify subsidiary tables and their characteristics
 * 
 * @param $ - Cheerio instance
 * @param tables - jQuery collection of table elements
 * @returns Array of TableInfo objects describing each table
 */
function processAllTables($: CheerioAPI, tables: any): TableInfo[] {
  const allTableInfos: TableInfo[] = [];
  let lastHeaders: string[] | null = null;
  let lastColumnCount = 0;

  tables.each((tableIndex: number, tbl: any) => {
    const $table = $(tbl);
    const rows = $table.find("tr");

    // Check for single-row footnote tables first
    if (rows.length === 1) {
      const text = $table.text().trim().toLowerCase();
      if (containsAny(text, SUBSIDIARY_KEYWORDS.FOOTNOTE_MARKERS) || text.length > 50) {
        logger.debug(`Table ${tableIndex}: Single row table with note-like content, treating as footnote`);
        allTableInfos.push({
          index: tableIndex,
          type: "footnote",
          rowCount: 1,
          columnCount: calculateColumnCount($, rows),
          headers: [],
          isContinuation: false,
          cheerioElement: $table,
        });
        return;
      }
    }

    // Skip tables with too few rows (but allow single-row footnotes above)
    if (rows.length < 2) {
      allTableInfos.push({
        index: tableIndex,
        type: "unknown",
        rowCount: 0, // No data rows
        columnCount: 0,
        headers: [],
        isContinuation: false,
        cheerioElement: $table,
      });
      return;
    }

    const headerRowIndex = findHeaderRow($, rows);

    let headers: string[];
    let isContinuation = false;
    let tableType: TableInfo["type"] = "unknown";
    let dataRowCount = 0; // Count of data rows (excluding header)

    if (headerRowIndex === -1) {
      // Second check: use the existing footer detection logic
      if (isLikelyFooterTable($, $table)) {
        logger.debug(`Table ${tableIndex}: Identified as footer table`);
        allTableInfos.push({
          index: tableIndex,
          type: "footnote",
          rowCount: rows.length, // Footer tables count all rows
          columnCount: calculateColumnCount($, rows),
          headers: [],
          isContinuation: false,
          cheerioElement: $table,
        });
        return;
      }

      // Check if this could be a continuation table
      if (lastHeaders === null) {
        logger.debug(`Table ${tableIndex}: No headers and no previous headers available`);
        allTableInfos.push({
          index: tableIndex,
          type: "unknown",
          rowCount: rows.length, // Count all rows for unknown tables
          columnCount: calculateColumnCount($, rows),
          headers: [],
          isContinuation: false,
          cheerioElement: $table,
        });
        return;
      }

      // Check column count compatibility
      const currentColumnCount = calculateColumnCount($, rows);
      if (currentColumnCount !== lastColumnCount) {
        logger.debug(`Table ${tableIndex}: Column count mismatch (${currentColumnCount} vs ${lastColumnCount})`);
        // If column count doesn't match and it looks like a footnote, classify as footnote
        const text = $table.text().trim().toLowerCase();
        if (containsAny(text, SUBSIDIARY_KEYWORDS.FOOTNOTE_MARKERS)) {
          logger.debug(`Table ${tableIndex}: Column mismatch with note-like content, treating as footnote`);
          allTableInfos.push({
            index: tableIndex,
            type: "footnote",
            rowCount: rows.length,
            columnCount: currentColumnCount,
            headers: [],
            isContinuation: false,
            cheerioElement: $table,
          });
          return;
        }
      }

      // This is a continuation table
      headers = null as any; // Continuation tables have no headers of their own
      isContinuation = true;
      tableType = "subsidiary"; // Assume continuation of subsidiary table
      dataRowCount = rows.length; // All rows are data rows in continuation tables
      logger.debug(`Table ${tableIndex}: Identified as continuation table`);
    } else {
      // Header row found - extract headers
      headers = extractHeaders($, rows[headerRowIndex]);

      // Check if this table has subsidiary keywords
      const headerText = headers.join(" ").toLowerCase();
      const hasSubsidiaryKeywords =
        containsAny(headerText, SUBSIDIARY_KEYWORDS.SUBSIDIARY_NAME) &&
        containsAny(headerText, SUBSIDIARY_KEYWORDS.JURISDICTION);

      if (hasSubsidiaryKeywords) {
        tableType = "subsidiary";
        
        // Calculate actual column count with colspan
        const $headerRow = $(rows[headerRowIndex]);
        const headerCells = $headerRow.find("td, th");
        let actualColumnCount = 0;
        headerCells.each((_: number, cell: any) => {
          const colspan = parseInt($(cell).attr("colspan") || "1", 10);
          actualColumnCount += colspan;
        });

        // Save headers for continuation tables
        lastHeaders = headers;
        lastColumnCount = actualColumnCount;
        
        // Count data rows (total rows minus header row)
        dataRowCount = rows.length - 1;
        logger.debug(`Table ${tableIndex}: Identified as subsidiary table (${actualColumnCount} columns, ${dataRowCount} data rows)`);
      } else {
        // Not a subsidiary table
        dataRowCount = rows.length - 1; // Exclude header row
        logger.debug(`Table ${tableIndex}: No subsidiary keywords found`);
      }
    }

    allTableInfos.push({
      index: tableIndex,
      type: tableType,
      rowCount: dataRowCount,
      columnCount: isContinuation ? lastColumnCount : calculateColumnCount($, rows),
      headers,
      isContinuation,
      cachedHeaders: isContinuation ? (lastHeaders as any) : undefined,
      cheerioElement: $table,
    });
  });

  return allTableInfos;
}

// ============================================================================
// Step 4: Classify Document (Extracted Method)
// ============================================================================

/**
 * Classify document based on subsidiary tables found
 * 
 * @param subsidiaryTables - Array of subsidiary table info
 * @returns Document classification
 */
function classifyDocument(subsidiaryTables: TableInfo[]): DocumentClassification {
  if (subsidiaryTables.length === 0) {
    return "has-table-no-data";
  }

  // Check if we have any tables with actual data rows
  const tablesWithData = subsidiaryTables.filter(t => t.rowCount > 0); // At least 1 data row
  
  if (tablesWithData.length === 0) {
    return "has-table-no-data";
  }

  // Return specific classifications based on number of tables
  if (subsidiaryTables.length === 1) {
    return "single-table";
  } else {
    return "multi-table";
  }
}
