/**
 * Structure Detection Phase
 *
 * Simplified version that focuses on the essential task:
 * 1. Find tables with subsidiary keywords in headers
 * 2. Detect text-based subsidiary listings
 * 3. Return a simple structure description
 */

import * as cheerio from "cheerio";
type CheerioAPI = ReturnType<typeof cheerio.load>;

import { createLogger } from "../../utils/logger";

import type {
  DocumentStructure,
  TableInfo,
  ParserConfig,
} from "./parser-types";
import { ParserError, DocumentClassification, TableType } from "./parser-types";
import {
  findHeaderRow,
  extractHeaders,
  isLikelyFooterTable,
  hasSubsidiaryData,
} from "./table-detection";
import {
  SUBSIDIARY_KEYWORDS,
  containsAny,
} from "../../config/subsidiary-keywords";

const logger = createLogger("parsers/subsidiary/structure-detection");

// ============================================================================
// Special Format Detection
// ============================================================================

/**
 * Detect if document uses special formats (images or embedded PDFs)
 * that require LLM processing instead of table parsing
 *
 * @param $ - Cheerio instance
 * @returns DocumentClassification if special format detected, null otherwise
 */
function detectSpecialFormats(
  $: CheerioAPI,
): DocumentClassification.IMAGE_BASED | DocumentClassification.PDF_BASED | null {
  // Check for embedded images that might contain subsidiary data
  const images = $("img");
  if (images.length > 0) {
    // Look for images that are likely to contain subsidiary information
    // (not just logos or decorative images)
    let hasSubstantialImage = false;
    
    images.each((_: number, img: any) => {
      const $img = $(img);
      const alt = ($img.attr("alt") || "").toLowerCase();
      const src = ($img.attr("src") || "").toLowerCase();
      
      // Check if image is substantial (likely contains data)
      // Heuristics:
      // 1. Image with "exhibit" or "subsidiary" in alt/src
      // 2. Image with substantial dimensions (width/height > 200px)
      // 3. Image with generic names like "image.jpg", "image_001.jpg", "image003.jpg" (often scanned documents)
      
      const hasRelevantName = 
        alt.includes("exhibit") || 
        alt.includes("subsidiary") ||
        src.includes("exhibit") ||
        src.includes("subsidiary") ||
        src.match(/^image[_\d]*\.(jpg|jpeg|png|gif)$/i) || // Match image.jpg, image_003.jpg, image123.jpg
        src.match(/^[a-z]+[_\d]+\.(jpg|jpeg|png|gif)$/i); // Match generic patterns like img_001.jpg
      
      // Check dimensions from style or attributes
      const style = $img.attr("style") || "";
      const width = parseInt($img.attr("width") || "0", 10);
      const height = parseInt($img.attr("height") || "0", 10);
      
      // Extract dimensions from style if present
      const styleWidthMatch = style.match(/width:\s*(\d+)px/);
      const styleHeightMatch = style.match(/height:\s*(\d+)px/);
      const styleWidth = styleWidthMatch ? parseInt(styleWidthMatch[1], 10) : 0;
      const styleHeight = styleHeightMatch ? parseInt(styleHeightMatch[1], 10) : 0;
      
      const actualWidth = Math.max(width, styleWidth);
      const actualHeight = Math.max(height, styleHeight);
      
      const isSubstantial = actualWidth > 200 || actualHeight > 200;
      
      if (hasRelevantName || isSubstantial) {
        hasSubstantialImage = true;
        logger.debug(
          `Found substantial image: src="${src}", alt="${alt}", dimensions=${actualWidth}x${actualHeight}`,
        );
        return false; // Stop iteration
      }
    });
    
    if (hasSubstantialImage) {
      return DocumentClassification.IMAGE_BASED;
    }
  }
  
  // Check for embedded PDFs or PDF viewers
  const embeds = $("embed, object, iframe");
  if (embeds.length > 0) {
    let hasPdfEmbed = false;
    
    embeds.each((_: number, element: any) => {
      const $element = $(element);
      const src = ($element.attr("src") || "").toLowerCase();
      const data = ($element.attr("data") || "").toLowerCase();
      const type = ($element.attr("type") || "").toLowerCase();
      
      if (
        src.includes(".pdf") ||
        data.includes(".pdf") ||
        type.includes("pdf")
      ) {
        hasPdfEmbed = true;
        logger.debug(`Found PDF embed: src="${src}", data="${data}", type="${type}"`);
        return false; // Stop iteration
      }
    });
    
    if (hasPdfEmbed) {
      return DocumentClassification.PDF_BASED;
    }
  }
  
  return null;
}

// ============================================================================
// Main Structure Detection Function
// ============================================================================

/**
 * Detect and analyze document structure.
 * @param $ - Cheerio instance (parsed once by the caller)
 * @param config - Parser configuration
 * @returns DocumentStructure describing the detected structure
 * @throws ParserError if detection fails
 */
export function detectDocumentStructure(
  $: CheerioAPI,
  config: ParserConfig,
): DocumentStructure {
  try {
    logger.debug("Starting structure detection");

    // Step 0: Check for image-based or PDF-based content FIRST
    const specialFormat = detectSpecialFormats($);
    if (specialFormat) {
      logger.debug(`Detected special format: ${specialFormat}`);
      return {
        classification: specialFormat,
        tables: [],
        totalTableCount: 0,
      };
    }

    // Step 1: Find all tables first to check if we have table-based structure
    const tables = $("table");
    logger.debug(`Found ${tables.length} tables in document`);

    // Step 2: Process tables to find subsidiary tables
    let allTableInfos: TableInfo[] = [];
    let subsidiaryTables: TableInfo[] = [];

    if (tables.length > 0) {
      allTableInfos = processAllTables($, tables);
      subsidiaryTables = allTableInfos.filter(
        (t) => t.type === TableType.SUBSIDIARY,
      );
    }

    // Step 3: Only check for text-based if we don't have any subsidiary tables
    if (subsidiaryTables.length === 0) {
      const textBasedInfo = detectTextBasedSubsidiaries($);
      if (textBasedInfo && textBasedInfo.entryCount > 0) {
        logger.debug(
          `Found text-based subsidiary listing with ${textBasedInfo.entryCount} entries`,
        );
        return {
          classification: DocumentClassification.TEXT_BASED,
          tables: [],
          totalTableCount: tables.length,
          textBased: textBasedInfo,
        };
      }
    }

    if (tables.length === 0) {
      logger.debug("No tables found - document is empty");
      return {
        classification: DocumentClassification.NO_TABLE,
        tables: [],
        totalTableCount: 0,
      };
    }

    // Step 4: Determine classification
    const classification = classifyDocument(subsidiaryTables);

    logger.debug(
      `Final classification: ${classification}, ${subsidiaryTables.length} subsidiary tables`,
    );

    return {
      classification,
      tables: allTableInfos,
      totalTableCount: tables.length,
    };
  } catch (error: any) {
    logger.error(`Structure detection failed: ${error.message}`);

    // Catch Cheerio parsing errors and throw ParserError
    if (
      error.name === "CheerioError" ||
      error.message?.includes("Invalid HTML")
    ) {
      throw new ParserError(
        `HTML parsing failed: ${error.message}`,
        "HTML_PARSE_ERROR",
        { originalError: error },
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// ============================================================================
// Helper Functions
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
function detectTextBasedSubsidiaries(
  $: CheerioAPI,
): import("./parser-types").TextBasedInfo | null {
  const candidateEntries: string[] = [];

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
      candidateEntries.push(normalizeTextEntry(text));
    }
  });

  // Need at least 2 entries to consider it a subsidiary list
  const uniqueEntries = Array.from(new Set(candidateEntries));
  if (uniqueEntries.length >= 2) {
    logger.debug(`Found ${uniqueEntries.length} text-based subsidiary entries`);
    return {
      entries: uniqueEntries,
      entryCount: uniqueEntries.length,
    };
  }

  return null;
}

function normalizeTextEntry(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
  const entitySuffixes = [
    "LLC",
    "Inc",
    "Corp",
    "Ltd",
    "Limited",
    "Company",
    "GmbH",
    "S.A.",
  ];
  const upperText = text.toUpperCase();

  return entitySuffixes.some((suffix) => upperText.includes(suffix));
}

/**
 * Check if text is likely a header or title (should be excluded)
 */
function isHeaderOrTitle(text: string): boolean {
  return containsAny(text, SUBSIDIARY_KEYWORDS.DOCUMENT_HEADERS);
}

/**
 * Calculate column count from table rows (accounting for colspan)
 */
function calculateColumnCount($: CheerioAPI, rows: any): number {
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
      if (
        containsAny(text, SUBSIDIARY_KEYWORDS.FOOTNOTE_MARKERS) ||
        text.length > 50
      ) {
        logger.debug(
          `Table ${tableIndex}: Single row table with note-like content, treating as footnote`,
        );
        allTableInfos.push({
          index: tableIndex,
          type: TableType.FOOTNOTE,
          rowCount: 1,
          columnCount: calculateColumnCount($, rows),
          headers: [],
          isContinuation: false,
        });
        return;
      }
    }

    // Skip tables with too few rows (but allow single-row footnotes above)
    if (rows.length < 2) {
      allTableInfos.push({
        index: tableIndex,
        type: TableType.UNKNOWN,
        rowCount: 0, // No data rows
        columnCount: 0,
        headers: [],
        isContinuation: false,
      });
      return;
    }

    const headerRowIndex = findHeaderRow($, rows);

    let headers: string[];
    let isContinuation = false;
    let tableType: TableInfo["type"] = TableType.UNKNOWN;
    let dataRowCount = 0; // Count of data rows (excluding header)

    if (headerRowIndex === -1) {
      // Second check: use the existing footer detection logic
      if (isLikelyFooterTable($, $table)) {
        logger.debug(`Table ${tableIndex}: Identified as footer table`);
        allTableInfos.push({
          index: tableIndex,
          type: TableType.FOOTNOTE,
          rowCount: rows.length, // Footer tables count all rows
          columnCount: calculateColumnCount($, rows),
          headers: [],
          isContinuation: false,
        });
        return;
      }

      // Check if this could be a continuation table
      if (lastHeaders === null) {
        logger.debug(
          `Table ${tableIndex}: No headers and no previous headers available`,
        );

        // Before giving up, check if this table has subsidiary data without headers
        if (hasSubsidiaryData($, $table)) {
          logger.debug(
            `Table ${tableIndex}: Found subsidiary data without explicit headers`,
          );
          allTableInfos.push({
            index: tableIndex,
            type: TableType.SUBSIDIARY,
            rowCount: rows.length, // All rows are data rows
            columnCount: calculateColumnCount($, rows),
            headers: null, // No explicit headers
            isContinuation: false,
          });
          return;
        }

        allTableInfos.push({
          index: tableIndex,
          type: TableType.UNKNOWN,
          rowCount: rows.length, // Count all rows for unknown tables
          columnCount: calculateColumnCount($, rows),
          headers: [],
          isContinuation: false,
        });
        return;
      }

      // Check column count compatibility
      const currentColumnCount = calculateColumnCount($, rows);
      if (currentColumnCount !== lastColumnCount) {
        logger.debug(
          `Table ${tableIndex}: Column count mismatch (${currentColumnCount} vs ${lastColumnCount})`,
        );
        // If column count doesn't match and it looks like a footnote, classify as footnote
        const text = $table.text().trim().toLowerCase();
        if (containsAny(text, SUBSIDIARY_KEYWORDS.FOOTNOTE_MARKERS)) {
          logger.debug(
            `Table ${tableIndex}: Column mismatch with note-like content, treating as footnote`,
          );
          allTableInfos.push({
            index: tableIndex,
            type: TableType.FOOTNOTE,
            rowCount: rows.length,
            columnCount: currentColumnCount,
            headers: [],
            isContinuation: false,
          });
          return;
        }
      }

      // This is a continuation table
      headers = null as any; // Continuation tables have no headers of their own
      isContinuation = true;
      tableType = TableType.SUBSIDIARY; // Assume continuation of subsidiary table
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
        tableType = TableType.SUBSIDIARY;

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
        logger.debug(
          `Table ${tableIndex}: Identified as subsidiary table (${actualColumnCount} columns, ${dataRowCount} data rows)`,
        );
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
      columnCount: isContinuation
        ? lastColumnCount
        : calculateColumnCount($, rows),
      headers,
      isContinuation,
      cachedHeaders: isContinuation ? (lastHeaders as any) : undefined,
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
function classifyDocument(
  subsidiaryTables: TableInfo[],
): DocumentClassification {
  if (subsidiaryTables.length === 0) {
    return DocumentClassification.HAS_TABLE_NO_DATA;
  }

  // Check if we have any tables with actual data rows
  const tablesWithData = subsidiaryTables.filter((t) => t.rowCount > 0); // At least 1 data row

  if (tablesWithData.length === 0) {
    return DocumentClassification.HAS_TABLE_NO_DATA;
  }

  // Return specific classifications based on number of tables
  if (subsidiaryTables.length === 1) {
    return DocumentClassification.SINGLE_TABLE;
  } else {
    return DocumentClassification.MULTI_TABLE;
  }
}
