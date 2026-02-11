/**
 * Type definitions for subsidiary parsing
 */

import type {
  SubsidiaryRecord,
  SubsidiaryParseResult,
  SubsidiaryParseMethod,
  SubsidiaryParseStatus,
  SubsidiaryFallbackPolicy,
  ParseTelemetry,
  LLMModification,
} from "../../pipeline/subsidiary/types";

export type {
  SubsidiaryRecord,
  SubsidiaryParseMethod,
  SubsidiaryParseStatus,
  SubsidiaryFallbackPolicy,
  ParseTelemetry,
  LLMModification,
} from "../../pipeline/subsidiary/types";

/**
 * Map of footnote number to footnote text
 * @deprecated Use footnotesHtml (raw HTML string) for LLM processing instead
 */
export type FootnoteMap = Record<string, string>;

export type ParseResult = SubsidiaryParseResult;

export interface ColumnAnalysis {
  isJurisdiction: boolean;
  isOwnership: boolean;
  jurisdictionValue: string;
  ownershipValue: number | undefined;
}

export interface ParsedColumns {
  rawName: string;
  cleanName: string;
  nameFootnoteRefs: string[];
  indentationSpaces: number;
  jurisdiction: string;
  ownership: number | undefined;
  ownershipFootnoteRefs: string[];
}

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
