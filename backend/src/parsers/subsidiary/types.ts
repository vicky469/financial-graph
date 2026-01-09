/**
 * Type definitions for subsidiary parsing
 */

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

export interface FootnoteMap {
  [key: string]: string; // e.g., { "1": "Owned through subsidiary X", "4": "100% owned" }
}

export interface ParseResult {
  subsidiaries: SubsidiaryRecord[];
  method: string;
  status: "success" | "empty" | "failed"; // success=found data, empty=no subsidiaries found, failed=error occurred
  tableCount: number;
  maxNestingLevel: number;
  footnotes: FootnoteMap; // Extracted footnotes from document
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
