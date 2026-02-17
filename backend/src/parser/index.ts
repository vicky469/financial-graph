/**
 * Subsidiary Parser - Public Re-export
 */

export { parseExhibit } from "./subsidiary/index";

// Re-export types from pipeline
export type {
  SubsidiaryRecord,
  ParseResult,
} from "../pipeline/subsidiary/types";

// Re-export parser-specific types
export type {
  ColumnAnalysis,
  ParsedColumns,
  ParserConfig,
  DocumentStructure,
  TableInfo,
} from "./subsidiary/parser-types";
