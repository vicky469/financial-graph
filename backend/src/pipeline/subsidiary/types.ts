import type { QualityAssessment } from "../../validation/types";
import type { SubsidiaryExhibit } from "../../config/subsidiary-exhibits";

export const SUBSIDIARY_PARSE_STATUS = ["success", "empty", "failed"] as const;
export type SubsidiaryParseStatus = (typeof SUBSIDIARY_PARSE_STATUS)[number];

export const SUBSIDIARY_PARSE_METHOD = ["heuristic", "llm-fallback"] as const;
export type SubsidiaryParseMethod = (typeof SUBSIDIARY_PARSE_METHOD)[number];

export type SubsidiaryFallbackPolicy = "llm" | "none";

export interface ParseTelemetry {
  timingsMs?: {
    heuristic?: number;
    validation?: number;
    llmFallback?: number;
    total?: number;
  };
  validation?: {
    total: number;
    valid: number;
    overallValid: boolean;
  };
  fallback?: {
    policy: SubsidiaryFallbackPolicy;
    used: boolean;
    reason?: string;
    provider?: string;
  };
}

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

export interface LLMModification {
  subsidiaryId: string;
  fieldChanges: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

export interface SubsidiaryParseResult {
  subsidiaries: SubsidiaryRecord[];
  method: SubsidiaryParseMethod;
  status: SubsidiaryParseStatus; // success=found data, empty=no subsidiaries found, failed=error occurred
  classification: string; // Document classification (text-based, single-table, multi-table, etc.)
  tableCount: number;
  maxNestingLevel: number;
  footnotesHtml: string; // Raw HTML of footnote sections
  llmModifications?: LLMModification[]; // Modifications made by LLM (if enrichment was used)
  errorMessage?: string;
  telemetry?: ParseTelemetry;
}

export type ParseResult = SubsidiaryParseResult;

/**
 * SEC Filing target - represents a single filing to process.
 */
export interface SECFilingTarget {
  accessionNumberNoDashes: string;
  cik: string;
  companyId: string; // Pre-resolved from DB
  companyName?: string; // For logging
  isSp500?: boolean; // From company.identity.sp500
  exhibitType: SubsidiaryExhibit; // EX-21, EX-8
  cachePath: string;
  url: string;
  metadata?: Record<string, any>;
}

/**
 * Filing with decompressed HTML content
 */
export interface DecompressedFiling extends SECFilingTarget {
  html: string;
}

/**
 * Filing after parsing
 */
export interface ParsedFiling extends SECFilingTarget {
  parseResult: ParseResult;
}

/**
 * Filing after validation
 */
export interface ValidatedFiling extends ParsedFiling {
  valid: boolean; // Shorthand for parseResult.status !== "failed"
  issues: string[];
  // Quality assessment metadata
  qualityScore?: number;
  needsReviewCount?: number;
  qualityAssessments?: QualityAssessment[];
}

export type SinkResult = {
  written: number;
  errors: number;
  details?: Record<string, any>;
};

export type SubsidiarySinkName = "db" | "excel";

export type SubsidiarySink = {
  name: string;
  write: (filings: ValidatedFiling[]) => Promise<SinkResult>;
};

export type SubsidiaryPipelineOptions = {
  year: number;
  limit?: number;
  sp500Only?: boolean;
  excludeSp500?: boolean;
  dryRun?: boolean;
  sinks?: SubsidiarySinkName[];
  fallbackPolicy?: SubsidiaryFallbackPolicy;
};

export type PipelineContext = {
  fallbackPolicy: SubsidiaryFallbackPolicy;
  jobConcurrency: number;
  llmWorkers: number;
  sinks: SubsidiarySink[];
  dryRun: boolean;
};

export type SubsidiaryPipelineResult = {
  processed: number;
  successCount: number;
  emptyCount: number;
  failedCount: number;
  sinkResults: Record<string, SinkResult>;
  targetCount: number;
  limitedTargetCount: number;
  dryRun: boolean;
};

export type ProcessingStats = {
  processed: number;
  successCount: number;
  emptyCount: number;
  failedCount: number;
  sinkResults: Record<string, SinkResult>;
};
