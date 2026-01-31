/**
 * CIK Lookup Query Definitions
 * 
 * In-memory cache of CIK -> Company ID mappings for fast lookups.
 * Shared between frontend and backend.
 */

import type { InstaQLParams } from "@instantdb/core";
import type { AppSchema } from "../../instant.schema";
import { CompanyType } from "../../types";

// In-memory cache: CIK -> Company ID
let cikToCompanyIdCache: Map<string, string> | null = null;

/**
 * Query definition: Get public companies with identity for CIK lookup
 */
export const cikLookupQuery = {
  company: {
    $: {
      where: { type: CompanyType.PUBLIC },
      fields: ["id", "identity"],
    },
  },
} satisfies InstaQLParams<AppSchema>;

/**
 * Helper: Build CIK lookup cache from query result
 */
export function buildCikCacheFromResult(result: any): Map<string, string> {
  const cache = new Map<string, string>();
  
  const companies = (result.company || []) as any[];

  for (const comp of companies) {
    if (comp.identity) {
      const identity = comp.identity as any;
      if (identity.primaryCIK) {
        cache.set(identity.primaryCIK, comp.id);
      }
    }
  }

  return cache;
}

/**
 * Set the global CIK lookup cache
 */
export function setCikLookupCache(cache: Map<string, string>): void {
  cikToCompanyIdCache = cache;
}

/**
 * Get the CIK lookup cache (returns null if not initialized)
 */
export function getCikLookupCache(): Map<string, string> | null {
  return cikToCompanyIdCache;
}

/**
 * Lookup company ID by CIK from cache
 * Returns null if CIK not found or cache not initialized
 */
export function lookupCompanyIdByCik(cik: string): string | null {
  if (!cikToCompanyIdCache) {
    return null;
  }
  
  // Normalize CIK to 10 digits
  const normalizedCik = cik.padStart(10, "0");
  return cikToCompanyIdCache.get(normalizedCik) || null;
}

/**
 * Check if cache is initialized
 */
export function isCikLookupCacheInitialized(): boolean {
  return cikToCompanyIdCache !== null;
}

/**
 * Get cache size
 */
export function getCikLookupCacheSize(): number {
  return cikToCompanyIdCache?.size || 0;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCikLookupCache(): void {
  cikToCompanyIdCache = null;
}
