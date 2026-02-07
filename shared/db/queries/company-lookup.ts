/**
 * Company Lookup Query Definitions
 *
 * Reusable, stateless query definitions and helpers.
 * Can be used with db.query() in both frontend and backend.
 */

import type { InstaQLParams } from "@instantdb/core";
import type { AppSchema } from "../../instant.schema";
import { CompanyType } from "../../types/types";

export interface CompanyLookupOptions {
  sp500Only?: boolean;
  excludeSp500?: boolean;
}

/**
 * Query definition: Get all public companies
 */
export const publicCompaniesQuery = {
  company: {
    $: {
      where: { type: CompanyType.PUBLIC },
      fields: ["id", "name", "identity"],
    },
  },
} satisfies InstaQLParams<AppSchema>;

/**
 * Helper: Extract CIK -> Company lookup from query result
 */
export function extractPublicCompaniesLookup(
  result: any,
  options?: CompanyLookupOptions,
): Map<string, { id: string; name: string }> {
  const { sp500Only = false, excludeSp500 = false } = options ?? {};
  const sp500Filter = sp500Only ? true : excludeSp500 ? false : null;

  const companies = (result?.company ?? []) as any[];
  const lookup = new Map<string, { id: string; name: string }>();

  for (const company of companies) {
    const cik = company?.identity?.primaryCIK;
    if (!cik) continue;

    if (sp500Filter !== null && company.identity?.sp500 !== sp500Filter) {
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
 * Helper: Build CIK -> Company ID lookup from query result
 */
export function extractPublicCikIdLookup(result: any): Map<string, string> {
  const cache = new Map<string, string>();
  const companies = (result?.company ?? []) as any[];

  for (const comp of companies) {
    const cik = comp?.identity?.primaryCIK;
    if (cik) {
      cache.set(cik, comp.id);
    }
  }

  return cache;
}
