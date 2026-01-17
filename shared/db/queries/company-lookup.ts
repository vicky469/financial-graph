/**
 * Company Lookup Query Definitions
 *
 * Reusable query definitions for company lookups.
 * Can be used with db.query() (frontend) or db.queryOnce() (backend).
 */

import { CompanyType } from "../../types/types";

export interface CompanyLookupResult {
  id: string;
  name: string;
  cik: string;
  sp500?: boolean;
}

export interface CompanyLookupOptions {
  sp500Only?: boolean;
}

/**
 * Query definition: Get all public companies
 */
export const publicCompaniesQuery = {
  company: {
    $: {
      where: { type: CompanyType.PUBLIC },
    },
  },
} as const;

/**
 * Helper: Extract CIK -> Company lookup from query result
 */
export function extractPublicCompaniesLookup(
  result: any,
  options: CompanyLookupOptions = {}
): Map<string, { id: string; name: string }> {
  const { sp500Only = false } = options;
  
  const companies = (result.company || []) as any[];
  const lookup = new Map<string, { id: string; name: string }>();

  for (const company of companies) {
    const cik = company.identity?.primaryCIK;
    if (!cik) continue;

    if (sp500Only && company.identity?.sp500 !== true) {
      continue;
    }

    lookup.set(cik, {
      id: company.id,
      name: company.name,
    });
  }

  return lookup;
}

/**
 * Helper: Extract CIK -> Company ID lookup from query result
 */
export function extractCikToCompanyIdLookup(
  result: any,
  options: CompanyLookupOptions = {}
): Map<string, string> {
  const lookup = extractPublicCompaniesLookup(result, options);
  const cikLookup = new Map<string, string>();

  for (const [cik, company] of lookup) {
    cikLookup.set(cik, company.id);
  }

  return cikLookup;
}

/**
 * Helper: Find company by CIK from query result
 */
export function findCompanyByCik(
  result: any,
  cik: string
): CompanyLookupResult | null {
  const normalizedCik = cik.padStart(10, "0");
  
  const companies = (result.company || []) as any[];
  const company = companies.find(
    (c: any) => c.identity?.primaryCIK === normalizedCik
  );

  if (!company) return null;

  return {
    id: company.id,
    name: company.name,
    cik: normalizedCik,
    sp500: company.identity?.sp500,
  };
}
