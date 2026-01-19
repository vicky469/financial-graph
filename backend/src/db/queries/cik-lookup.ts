/**
 * CIK Lookup Cache - Backend Implementation
 * 
 * Uses admin client with shared query definitions.
 * Checks in-memory cache first before hitting the database.
 */

import { db } from "../client";
import { createLogger } from "../../utils/logger";
import {
  cikLookupQuery,
  buildCikCacheFromResult,
  setCikLookupCache,
  getCikLookupCache,
  lookupCompanyIdByCik,
  isCikLookupCacheInitialized,
  getCikLookupCacheSize,
  clearCikLookupCache,
} from "@financial-graph/shared/db";

const logger = createLogger("cik-lookup");

/**
 * Load the CIK lookup cache from database if not already cached
 * Returns the cache Map (CIK -> Company ID)
 */
export async function loadCikLookupCache(): Promise<Map<string, string>> {
  // Check if cache is already initialized
  const existingCache = getCikLookupCache();
  if (existingCache) {
    logger.info(`Using existing CIK lookup cache with ${existingCache.size} mappings`);
    return existingCache;
  }

  logger.info("Building CIK to Company ID mappings from Database...");
  
  const result = await db.query(cikLookupQuery);
  const cache = buildCikCacheFromResult(result);
  
  setCikLookupCache(cache);
  logger.info(`Built ${cache.size} CIK -> Company ID mappings from DB.`);
  
  return cache;
}

// Re-export shared functions for convenience
export {
  lookupCompanyIdByCik,
  isCikLookupCacheInitialized,
  getCikLookupCacheSize,
  clearCikLookupCache,
};
