/**
 * Type definitions for refactored subsidiary parser
 *
 * This file contains types for the two-phase parsing architecture:
 * 1. Structure Detection Phase - Analyzes HTML to identify tables
 * 2. Content Extraction Phase - Parses table rows and extracts subsidiary records
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for the parser
 */
export interface ParserConfig {
  /**
   * Whether to extract and process footnotes
   * @default true
   */
  processFootnotes: boolean;

  /**
   * Maximum nesting depth for subsidiaries
   * @default 10
   */
  maxDepth: number;

  /**
   * Whether to require exact keyword matches in headers
   * When false, uses fuzzy matching for header classification
   * @default false
   */
  strictHeaderMatching: boolean;
}

/**
 * Default parser configuration
 */
export const DEFAULT_CONFIG: ParserConfig = {
  processFootnotes: true,
  maxDepth: 10,
  strictHeaderMatching: false,
};

// ============================================================================
// Structure Detection Phase Types
// ============================================================================

/**
 * Document classification based on structure
 */
export type DocumentClassification =
  | "single-table" // One subsidiary table
  | "multi-table" // Multiple subsidiary tables (may include continuations)
  | "no-table" // No tables found
  | "has-table-no-data" // Tables exist but no data rows
  | "text-based"; // Text-based subsidiary listing (no tables)

/**
 * Table type classification
 */
export type TableType = "subsidiary" | "footnote" | "unknown";

/**
 * Information about a detected table
 */
export interface TableInfo {
  /**
   * Position of table in document (0-indexed)
   */
  index: number;

  /**
   * Classification of table type
   */
  type: TableType;

  /**
   * Extracted header row values
   * null for continuation tables (headers are in cachedHeaders)
   */
  headers: string[] | null;

  /**
   * Whether this table is a continuation of a previous table
   */
  isContinuation: boolean;

  /**
   * Headers from previous subsidiary table (for continuation tables)
   */
  cachedHeaders?: string[];

  /**
   * Number of columns in the table (accounting for colspan)
   */
  columnCount: number;

  /**
   * Number of data rows in the table (excluding header)
   */
  rowCount: number;

  /**
   * Reference to the Cheerio table element (used during structure detection)
   */
  cheerioElement: any;
}

/**
 * Information about text-based subsidiary elements
 */
export interface TextBasedInfo {
  /**
   * Array of Cheerio elements containing subsidiary information
   */
  elements: any[];

  /**
   * Total number of text-based subsidiary entries found
   */
  entryCount: number;
}

/**
 * Result of structure detection phase
 */
export interface DocumentStructure {
  /**
   * Overall document classification
   */
  classification: DocumentClassification;

  /**
   * Information about all detected tables
   */
  tables: TableInfo[];

  /**
   * Total number of tables found in document
   */
  totalTableCount: number;

  /**
   * Information about text-based subsidiary listings (if any)
   */
  textBased?: TextBasedInfo;
}

// ============================================================================
// Content Extraction Phase Types
// ============================================================================

/**
 * Input for content extraction phase
 */
export interface ContentExtractionInput {
  /**
   * Document structure from detection phase
   */
  structure: DocumentStructure;

  /**
   * Original HTML content (needed to re-parse and find tables)
   */
  html: string;

  /**
   * Parser configuration
   */
  config: ParserConfig;

  /**
   * Filing information for logging and ID generation
   */
  filing: {
    accession_number: string;
    cik: string;
    filingCompanyId: string;
    filingCompanyName?: string;
  };
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Custom error class for parser errors
 */
export class ParserError extends Error {
  /**
   * Error code for categorization
   */
  code: string;

  /**
   * Additional context about the error
   */
  context?: Record<string, any>;

  constructor(message: string, code: string = "PARSER_ERROR", context?: Record<string, any>) {
    super(message);
    this.name = "ParserError";
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParserError);
    }
  }
}
