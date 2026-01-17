/**
 * CIK Lookup Cache - Backend Implementation
 * 
 * Uses admin client with shared query definitions.
 */

import { db } from "../client";
import { createLogger } from "../../utils/logger";
import {
  cikLookupQuery,
  buildCikCacheFromResult,
  setCikLookupCache,
  lookupCompanyIdByCik,
  isCikLookupCacheInitialized,
  getCikLookupCacheSize,
  clearCikLookupCache,
} from "@financial-graph/shared/db";

const logger = createLogger("cik-lookup");

/**
 * Load the CIK lookup cache from database
 * If cache is already initialized, returns existing cache size
 */
export async function loadCikLookupCache(): Promise<void> {
  if (isCikLookupCacheInitialized()) {
    logger.info(`Using existing CIK lookup cache with ${getCikLookupCacheSize()} mappings`);
    return;
  }

  logger.info("Building CIK to Company ID mappings from Database...");
  
  const result = await db.query(cikLookupQuery);
  const cache = buildCikCacheFromResult(result);
  
  setCikLookupCache(cache);
  logger.info(`Built ${cache.size} CIK -> Company ID mappings from DB.`);
}

// Re-export shared functions for convenience
export {
  lookupCompanyIdByCik,
  isCikLookupCacheInitialized,
  getCikLookupCacheSize,
  clearCikLookupCache,
};
