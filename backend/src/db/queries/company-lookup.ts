/**
 * Backend Company Lookup Queries
 *
 * Thin wrapper around shared query definitions, using the admin client.
 * Keeps caching local to the backend process.
 */

import { db } from "../client";
import {
  publicCompaniesQuery,
  buildCompanyLookup,
  type CompanyLookupOptions,
} from "@financial-graph/shared/db";

let queryResultCache: any | null = null;
let allCompaniesCache: Map<
  string,
  { id: string; name: string; isSp500: boolean }
> | null = null;

const normalizeCik = (cik: string): string => cik.padStart(10, "0");

async function ensurePublicCompaniesLoaded(): Promise<
  Map<string, { id: string; name: string; isSp500: boolean }>
> {
  if (!allCompaniesCache) {
    queryResultCache = await db.query(publicCompaniesQuery);
    allCompaniesCache = buildCompanyLookup(queryResultCache);
  }
  return allCompaniesCache;
}

export async function loadPublicCompaniesLookup(
  options: CompanyLookupOptions = {},
): Promise<Map<string, { id: string; name: string; isSp500: boolean }>> {
  await ensurePublicCompaniesLoaded();
  if (!options.mode || options.mode === "all") return allCompaniesCache!;
  return buildCompanyLookup(queryResultCache, options);
}

export function lookupCompanyIdByCik(cik: string): string | null {
  if (!allCompaniesCache) return null;
  return allCompaniesCache.get(normalizeCik(cik))?.id ?? null;
}

export function clearCompanyLookupCache(): void {
  queryResultCache = null;
  allCompaniesCache = null;
}
