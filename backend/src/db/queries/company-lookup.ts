/**
 * Company Lookup Queries
 *
 * Backend implementation using admin client with shared query definitions.
 */

import { db } from "../client";
import {
  publicCompaniesQuery,
  extractPublicCompaniesLookup,
  extractCikToCompanyIdLookup,
  findCompanyByCik,
  CompanyLookupOptions,
  CompanyLookupResult,
} from "@financial-graph/shared/db";

/**
 * Get public companies as a CIK -> Company lookup map.
 *
 * @param options.sp500Only - Only include SP500 companies (defaults to true)
 * @returns Map of CIK -> { id, name }
 */
export async function getPublicCompaniesLookup(
  options: CompanyLookupOptions = { sp500Only: true }
): Promise<Map<string, { id: string; name: string }>> {
  const result = await db.query(publicCompaniesQuery);
  return extractPublicCompaniesLookup(result, options);
}

/**
 * Get CIK -> Company ID lookup map.
 * Simpler version that only returns IDs.
 *
 * @param options.sp500Only - Only include SP500 companies (defaults to true)
 * @returns Map of CIK -> companyId
 */
export async function getCikToCompanyIdLookup(
  options: CompanyLookupOptions = { sp500Only: true }
): Promise<Map<string, string>> {
  const result = await db.query(publicCompaniesQuery);
  return extractCikToCompanyIdLookup(result, options);
}

/**
 * Get company by CIK (single lookup, hits DB).
 * For batch operations, use getPublicCompaniesLookup() instead.
 */
export async function getCompanyByCik(
  cik: string
): Promise<CompanyLookupResult | null> {
  const result = await db.query(publicCompaniesQuery);
  return findCompanyByCik(result, cik);
}

// Re-export types for convenience
export type { CompanyLookupOptions, CompanyLookupResult };
