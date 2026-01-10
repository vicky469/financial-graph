/**
 * Type definitions for subsidiary parsing
 */

import { LLMModification } from "./llm-enrichment";

export type { LLMModification } from "./llm-enrichment";

/**
 * Map of footnote number to footnote text
 * @deprecated Use footnotesHtml (raw HTML string) for LLM processing instead
 */
export type FootnoteMap = Record<string, string>;

export interface SubsidiaryRecord {
  id: string; // Generated UUID for this subsidiary
  name: string;
  jurisdiction: string;
  nestingLevel: number;
  parentName?: string; // For nested subsidiaries (human-readable)
  parentId?: string; // UUID of parent company (for database relations)
  ownership?: number; // Ownership percentage
  footnoteRefs: string[]; // Footnote reference numbers (e.g., ["1", "4"])
  indentationSpaces: number;
  isNested: boolean;
}

export interface ParseResult {
  subsidiaries: SubsidiaryRecord[];
  method: string;
  status: "success" | "empty" | "failed"; // success=found data, empty=no subsidiaries found, failed=error occurred
  tableCount: number;
  maxNestingLevel: number;
  footnotesHtml: string; // Raw HTML of footnote sections
  llmModifications?: LLMModification[]; // Modifications made by LLM (if enrichment was used)
  errorMessage?: string;
}

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
