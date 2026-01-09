/**
 * Subsidiary Parser - Backward Compatibility Re-export
 * 
 * This file maintains backward compatibility for code that imports from
 * the old monolithic subsidiary-parser.ts file.
 * 
 * New code should import directly from:
 * - src/parsers/subsidiary/index.ts (main parser)
 * - src/parsers/subsidiary/types.ts (type definitions)
 */

// Re-export main parser function
export { parseExhibit } from "./subsidiary/index";

// Re-export types
export type {
  SubsidiaryRecord,
  ParseResult,
  FootnoteMap,
  ColumnAnalysis,
  ParsedColumns,
} from "./subsidiary/types";
