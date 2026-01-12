import { db } from "../client";
import { createLogger } from "../../utils/logger";
import { CompanyType } from "@financial-graph/shared";

const logger = createLogger("cik-lookup");

/**
 * CIK Lookup Cache
 * 1. In-memory cache of CIK -> Company ID mappings
 * 2. Functions to build and query the cache
 */

// In-memory cache: CIK -> Company ID
let cikToCompanyId: Map<string, string> | null = null;


/**
 * Build the CIK lookup cache from database
 * Returns the cache Map
 */
async function buildCikCompanyLookupCache(): Promise<Map<string, string>> {
  logger.info("Building CIK to Company ID mappings from Database...");

  const res = await db.query({
    company: {
      $: {
        where: { type: CompanyType.PUBLIC },
        fields: ["id", "identity"],
      },
    },
  });

  const cache = new Map<string, string>();

  if (res.company) {
    for (const comp of res.company) {
      if (comp.identity) {
        const identity = comp.identity as any;
        if (identity.primaryCIK) {
          cache.set(identity.primaryCIK, comp.id);
        }
      }
    }
  }

  logger.info(`Built ${cache.size} CIK -> Company ID mappings from DB.`);
  return cache;
}

/**
 * Load the CIK lookup cache
 * If cache is null, builds it from database
 * Returns the cache Map
 */
export async function loadCikLookupCache(): Promise<Map<string, string>> {
  if (isCacheInitialized()) {
    logger.info(`Using existing CIK lookup cache with ${cikToCompanyId!.size} mappings`);
    return cikToCompanyId!;
  }

  cikToCompanyId = await buildCikCompanyLookupCache();
  return cikToCompanyId;
}

/**
 * Get company ID by CIK
 * Returns null if CIK not found
 */
export function getCompanyIdByCik(cik: string): string | null {
  if (!cikToCompanyId) {
    throw new Error("CIK lookup cache not initialized. Call loadCikLookupCache() first.");
  }
  
  // Normalize CIK to 10 digits
  const normalizedCik = cik.padStart(10, "0");
  return cikToCompanyId.get(normalizedCik) || null;
}

/**
 * Check if cache is initialized
 */
export function isCacheInitialized(): boolean {
  return cikToCompanyId !== null;
}


/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  cikToCompanyId = null;
}
