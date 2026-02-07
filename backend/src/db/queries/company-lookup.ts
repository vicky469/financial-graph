/**
 * Backend Company Lookup Queries
 *
 * Thin wrapper around shared query definitions, using the admin client.
 * Keeps caching local to the backend process.
 */

import { db } from "../client";
import {
  publicCompaniesQuery,
  extractPublicCompaniesLookup,
  extractPublicCikIdLookup,
  type CompanyLookupOptions,
} from "@financial-graph/shared/db";

let cikToCompanyIdCache: Map<string, string> | null = null;
let publicCompaniesResultCache: any | null = null;

const normalizeCik = (cik: string): string => cik.padStart(10, "0");

export async function loadPublicCompaniesLookup(
  options: CompanyLookupOptions = {},
): Promise<Map<string, { id: string; name: string }>> {
  if (!publicCompaniesResultCache) {
    publicCompaniesResultCache = await db.query(publicCompaniesQuery);
    cikToCompanyIdCache = extractPublicCikIdLookup(publicCompaniesResultCache);
  }

  return extractPublicCompaniesLookup(publicCompaniesResultCache, options);
}

export async function loadPublicCikLookupCache(
): Promise<Map<string, string>> {
  if (!publicCompaniesResultCache) {
    publicCompaniesResultCache = await db.query(publicCompaniesQuery);
  }

  if (!cikToCompanyIdCache) {
    cikToCompanyIdCache = extractPublicCikIdLookup(publicCompaniesResultCache);
  }

  return cikToCompanyIdCache ?? new Map<string, string>();
}

export function lookupCompanyIdByCik(cik: string): string | null {
  if (!cikToCompanyIdCache) {
    return null;
  }

  return cikToCompanyIdCache.get(normalizeCik(cik)) || null;
}
