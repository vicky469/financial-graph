/**
 * Type definitions for the subsidiary parser.
 * Used by structure detection and content extraction.
 */

import type { SubsidiaryFallbackPolicy } from "../../pipeline/subsidiary/types";

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

  /**
   * Whether to use LLM fallback when heuristic parsing is empty or invalid
   * @default \"llm\"
   */
  fallbackPolicy?: SubsidiaryFallbackPolicy;
}

/**
 * Default parser configuration
 */
export const DEFAULT_CONFIG: ParserConfig = {
  processFootnotes: true,
  maxDepth: 10,
  strictHeaderMatching: false,
  fallbackPolicy: "llm",
};

// ============================================================================
// Structure Detection Phase Types
// ============================================================================

/**
 * Document classification based on structure
 */
export enum DocumentClassification {
  SINGLE_TABLE = "single-table",
  MULTI_TABLE = "multi-table",
  NO_TABLE = "no-table",
  HAS_TABLE_NO_DATA = "has-table-no-data",
  TEXT_BASED = "text-based",
  IMAGE_BASED = "image-based",
  PDF_BASED = "pdf-based",
}

/**
 * Table type classification
 */
export enum TableType {
  SUBSIDIARY = "subsidiary",
  FOOTNOTE = "footnote",
  UNKNOWN = "unknown",
}

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
}

/**
 * Information about text-based subsidiary elements
 */
export interface TextBasedInfo {
  /**
   * Text entries containing subsidiary information
   */
  entries: string[];

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
   * Cheerio instance (parsed once, shared across phases)
   */
  $: any;

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

  constructor(
    message: string,
    code: string = "PARSER_ERROR",
    context?: Record<string, any>,
  ) {
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
