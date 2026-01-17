/**
 * CIK Lookup Query Definitions
 * 
 * In-memory cache of CIK -> Company ID mappings for fast lookups.
 * Shared between frontend and backend.
 */

import type { InstaQLParams } from "@instantdb/core";
import type { AppSchema } from "../../instant.schema";
import { CompanyType } from "../../types/types";

// In-memory cache: CIK -> Company ID
let cikToCompanyId: Map<string, string> | null = null;

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
  cikToCompanyId = cache;
  console.log(`CIK lookup cache set with ${cache.size} mappings`);
}

/**
 * Lookup company ID by CIK from cache
 * Returns null if CIK not found
 */
export function lookupCompanyIdByCik(cik: string): string | null {
  if (!cikToCompanyId) {
    throw new Error("CIK lookup cache not initialized. Call setCikLookupCache() first.");
  }
  
  // Normalize CIK to 10 digits
  const normalizedCik = cik.padStart(10, "0");
  return cikToCompanyId.get(normalizedCik) || null;
}

/**
 * Check if cache is initialized
 */
export function isCikLookupCacheInitialized(): boolean {
  return cikToCompanyId !== null;
}

/**
 * Get cache size
 */
export function getCikLookupCacheSize(): number {
  return cikToCompanyId?.size || 0;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCikLookupCache(): void {
  cikToCompanyId = null;
}
