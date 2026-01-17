/**
 * Subsidiaries Pipeline Types
 */

import { SECFilingTarget } from "../sources/types";
import type {
  SubsidiaryRecord,
  ParseResult,
} from "../../parser/subsidiary/types";

/**
 * Filing with decompressed HTML content
 */
export interface DecompressedFiling extends SECFilingTarget {
  html: string;
}

/**
 * Filing after parsing
 */
export interface ParsedFiling extends DecompressedFiling {
  parseResult: ParseResult;
  success: boolean;
}

/**
 * Filing after validation
 */
export interface ValidatedFiling extends ParsedFiling {
  valid: boolean;
  issues: string[];
}

// Re-export for convenience
export type { SubsidiaryRecord, ParseResult };
