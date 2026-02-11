/**
 * Subsidiary Parser - Public Re-export
 */

export { parseExhibit } from "./subsidiary/index";

// Re-export types
export type {
  SubsidiaryRecord,
  ParseResult,
  FootnoteMap,
  ColumnAnalysis,
  ParsedColumns,
} from "./subsidiary/types";

// Re-export parser types
export type {
  ParserConfig,
  DocumentStructure,
  TableInfo,
} from "./subsidiary/index";
