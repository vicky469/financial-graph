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
  // Quality assessment metadata
  qualityScore?: number;
  needsReviewCount?: number;
  qualityAssessments?: QualityAssessment[];
}

// Quality assessment types
export interface ValidationIssue {
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  field: 'name' | 'jurisdiction' | 'pattern';
  message: string;
  score: number; // Impact on quality score (0-100)
}

export interface QualityAssessment {
  score: number; // 0-100
  issues: ValidationIssue[];
  needsReview: boolean;
}

// Re-export for convenience
export type { SubsidiaryRecord, ParseResult };
