/**
 * Source Types
 *
 * Common data structures for pipeline sources.
 */

/**
 * SEC Filing target - represents a single filing to process.
 * Used by subsidiaries, ownership, and other SEC-related pipelines.
 */
export interface SECFilingTarget {
  accessionNumber: string;
  cik: string;
  companyId: string; // Pre-resolved from DB
  companyName?: string; // For logging
  exhibitType: string; // EX-21, EX-8, etc.
  cachePath: string;
  url: string;
  metadata?: Record<string, any>;
}

/**
 * Configuration for SEC filing sources
 */
export interface SECFilingSourceConfig {
  cacheBaseDir: string;
  exhibitTypes: string[];
  year: number;
}
