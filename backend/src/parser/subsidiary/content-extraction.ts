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
 * IMPORTANT: This module re-parses HTML and finds tables by index rather than using
 * stored cheerio elements, because cheerio elements from different load() calls
 * are incompatible.
 */

import { load } from "cheerio";
import { createLogger } from "../../utils/logger";

import type {
  DocumentStructure,
  TableInfo,
  ParserConfig,
  ContentExtractionInput,
} from "./types-refactored";
import { ParserError } from "./types-refactored";
import type { SubsidiaryRecord, ParseResult } from "./types";
import { extractSubsidiaries } from "./extraction";
import { findHeaderRow, extractHeaders } from "./table-detection";
import { extractDocumentFootnotes } from "./footnotes";
import { preprocessFootnotesHtml } from "./footnotes-preprocessor";

type CheerioAPI = ReturnType<typeof load>;

const logger = createLogger("parsers/subsidiary/content-extraction");

// ============================================================================
// Types
// ============================================================================

/**
 * Result of content extraction phase
 * Directly produces the record format consumers expect
 */
export interface ContentExtractionResult {
  /** Extracted subsidiary records */
  subsidiaries: SubsidiaryRecord[];
  /** Maximum nesting level found */
  maxNestingLevel: number;
  /** Preprocessed footnotes HTML for LLM enrichment */
  footnotesHtml: string;
  /** Number of tables processed */
  tableCount: number;
}

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
 * @param input - Content extraction input containing structure, html, config, and filing
 * @returns ContentExtractionResult with subsidiaries and metadata
 * @throws ParserError if extraction fails
 */
export function extractSubsidiaryRecords(input: ContentExtractionInput): ContentExtractionResult {
  const { structure, html, config, filing } = input;

  try {
    logger.debug(`[${filing.accession_number}] Starting content extraction for ${structure.classification}`);

    // Parse HTML with Cheerio
    const $ = load(html, { xmlMode: false, decodeEntities: true });

    // Extract footnotes from the entire document
    const rawFootnotesHtml = config.processFootnotes ? extractDocumentFootnotes($) : "";
    const footnotesHtml = config.processFootnotes ? preprocessFootnotesHtml(rawFootnotesHtml) : "";

    // Handle no-table, no-data, or text-based cases
    if (structure.classification === "no-table" || structure.classification === "has-table-no-data") {
      logger.info(`[${filing.accession_number}] No extractable content: ${structure.classification}`);
      return {
        subsidiaries: [],
        maxNestingLevel: 0,
        footnotesHtml,
        tableCount: structure.totalTableCount,
      };
    }

    // Handle text-based subsidiary listings
    if (structure.classification === "text-based" && structure.textBased) {
      logger.info(`[${filing.accession_number}] Processing text-based subsidiaries: ${structure.textBased.entryCount} entries`);
      const subsidiaries = extractTextBasedSubsidiaries($, structure.textBased, filing);
      const maxNestingLevel = subsidiaries.length > 0
        ? Math.max(...subsidiaries.map((s) => s.nestingLevel))
        : 0;

      logger.info(`[${filing.accession_number}] Extracted ${subsidiaries.length} text-based subsidiaries`);

      return {
        subsidiaries,
        maxNestingLevel,
        footnotesHtml,
        tableCount: structure.totalTableCount,
      };
    }

    // Filter subsidiary tables
    const subsidiaryTables = structure.tables.filter((t) => t.type === "subsidiary");

    if (subsidiaryTables.length === 0) {
      logger.info(`[${filing.accession_number}] No subsidiary tables found in structure`);
      return {
        subsidiaries: [],
        maxNestingLevel: 0,
        footnotesHtml,
        tableCount: structure.totalTableCount,
      };
    }

    logger.info(`[${filing.accession_number}] Processing ${subsidiaryTables.length} subsidiary tables`);

    // Re-find all tables in the document (we can't use stored cheerioElement)
    const allTables: ReturnType<CheerioAPI>[] = [];
    $("table").each((_: number, tbl: any) => {
      allTables.push($(tbl));
    });

    // Process all subsidiary tables and combine results
    const allSubsidiaries: SubsidiaryRecord[] = [];

    for (const tableInfo of subsidiaryTables) {
      logger.debug(`[${filing.accession_number}] Processing table ${tableInfo.index} (${tableInfo.isContinuation ? 'continuation' : 'main'}, ${tableInfo.rowCount} rows)`);
      
      // Find the table by index in our freshly-parsed DOM
      const $table = allTables[tableInfo.index];
      if (!$table) {
        logger.warn(`[${filing.accession_number}] Table ${tableInfo.index} not found in DOM`);
        continue;
      }

      const rows = $table.find("tr");

      // Determine headers to use
      const headers = getHeadersForTable($, rows, tableInfo);
      if (headers.length === 0) {
        logger.debug(`[${filing.accession_number}] Table ${tableInfo.index}: No headers available, skipping`);
        continue;
      }

      // Determine start row index
      const headerRowIndex = tableInfo.isContinuation ? -1 : findHeaderRow($, rows);

      // Use the existing extractSubsidiaries function - it has all the proper
      // column swapping, fallback logic, and validation
      const subsidiaries = extractSubsidiaries($, rows, headerRowIndex, headers, filing);
      logger.debug(`[${filing.accession_number}] Table ${tableInfo.index}: Extracted ${subsidiaries.length} subsidiaries`);
      
      allSubsidiaries.push(...subsidiaries);
    }

    // Calculate max nesting level
    const maxNestingLevel = allSubsidiaries.length > 0
      ? Math.max(...allSubsidiaries.map((s) => s.nestingLevel))
      : 0;

    logger.info(`[${filing.accession_number}] Content extraction complete: ${allSubsidiaries.length} subsidiaries (maxNesting: ${maxNestingLevel})`);

    return {
      subsidiaries: allSubsidiaries,
      maxNestingLevel,
      footnotesHtml,
      tableCount: structure.totalTableCount,
    };
  } catch (error: any) {
    logger.error(`[${filing.accession_number}] Content extraction failed: ${error.message}`);
    
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get headers for a table, handling continuation tables
 */
function getHeadersForTable(
  $: CheerioAPI,
  rows: ReturnType<ReturnType<CheerioAPI>["find"]>,
  tableInfo: TableInfo
): string[] {
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

// ============================================================================
// Text-Based Subsidiary Extraction
// ============================================================================

/**
 * Extract subsidiaries from text-based listings
 * 
 * Handles formats like:
 * - Company Name (Jurisdiction)
 * - Company Name - Jurisdiction
 * - Company Name, Jurisdiction
 * 
 * @param $ - Cheerio instance
 * @param textBasedInfo - Text-based subsidiary information from structure detection
 * @param filing - Filing information for ID generation
 * @returns Array of SubsidiaryRecord objects
 */
function extractTextBasedSubsidiaries(
  $: CheerioAPI,
  textBasedInfo: import("./types-refactored").TextBasedInfo,
  filing: { accession_number: string; cik: string; filingCompanyId: string; filingCompanyName?: string }
): SubsidiaryRecord[] {
  const subsidiaries: SubsidiaryRecord[] = [];

  for (const element of textBasedInfo.elements) {
    const text = element.text().trim();
    const parsed = parseTextBasedEntry(text);
    
    if (parsed) {
      // Generate unique ID for this subsidiary
      const id = `${filing.filingCompanyId}-sub-${subsidiaries.length + 1}`;
      
      // Extract footnote references (simple pattern matching)
      const footnoteRefs = extractFootnoteReferences(text);
      
      const subsidiary: SubsidiaryRecord = {
        id,
        name: parsed.name,
        jurisdiction: parsed.jurisdiction,
        nestingLevel: 0, // Text-based entries are always flat
        parentName: filing.filingCompanyName, // Parent is the filing company
        parentId: filing.filingCompanyId,
        ownership: parsed.ownership,
        footnoteRefs,
        indentationSpaces: 0,
        isNested: false,
      };
      
      subsidiaries.push(subsidiary);
    }
  }

  return subsidiaries;
}

/**
 * Parse a single text-based subsidiary entry
 * 
 * @param text - Text content to parse
 * @returns Parsed subsidiary information or null if parsing fails
 */
function parseTextBasedEntry(text: string): {
  name: string;
  jurisdiction: string;
  ownership?: number;
} | null {
  // Remove footnote references for parsing (but keep original for footnote extraction)
  const cleanText = text.replace(/\(\d+\)/g, '').trim();
  
  // Pattern 1: Company Name (Jurisdiction)
  const parenthesesMatch = cleanText.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenthesesMatch) {
    return {
      name: parenthesesMatch[1].trim(),
      jurisdiction: parenthesesMatch[2].trim(),
    };
  }
  
  // Pattern 2: Company Name - Jurisdiction
  const dashMatch = cleanText.match(/^(.+?)\s*-\s*([^-]+)$/);
  if (dashMatch) {
    return {
      name: dashMatch[1].trim(),
      jurisdiction: dashMatch[2].trim(),
    };
  }
  
  // Pattern 3: Company Name, Jurisdiction
  const commaMatch = cleanText.match(/^(.+?),\s*([^,]+)$/);
  if (commaMatch) {
    return {
      name: commaMatch[1].trim(),
      jurisdiction: commaMatch[2].trim(),
    };
  }
  
  // Pattern 4: Just company name (no jurisdiction)
  // Check if it has business entity suffixes
  const entitySuffixes = [
    'LLC', 'Inc', 'Corp', 'Ltd', 'Limited', 'Company', 'Co.',
    'GmbH', 'S.A.', 'S.L.', 'SRL', 'AB', 'PTY', 'PTE', 'K.K.',
    'Yuhan Hoesa', 'Private Limited', 'FZ LLC'
  ];
  
  const upperText = cleanText.toUpperCase();
  const hasEntitySuffix = entitySuffixes.some(suffix => 
    upperText.includes(suffix.toUpperCase())
  );
  
  if (hasEntitySuffix && cleanText.length > 5) {
    return {
      name: cleanText,
      jurisdiction: "Unknown",
    };
  }
  
  return null;
}

/**
 * Extract footnote references from text
 * 
 * @param text - Text to search for footnote references
 * @returns Array of footnote reference numbers
 */
function extractFootnoteReferences(text: string): string[] {
  const footnoteRefs: string[] = [];
  const matches = text.match(/\((\d+)\)/g);
  
  if (matches) {
    for (const match of matches) {
      const num = match.replace(/[()]/g, '');
      if (!footnoteRefs.includes(num)) {
        footnoteRefs.push(num);
      }
    }
  }
  
  return footnoteRefs;
}