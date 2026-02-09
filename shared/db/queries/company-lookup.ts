/**
 * Company Lookup Query Definitions
 *
 * Reusable, stateless query definitions and helpers.
 * Can be used with db.query() in both frontend and backend.
 */

import type { InstaQLParams } from "@instantdb/core";
import type { AppSchema } from "../../instant.schema";
import { CompanyType } from "../../types/types";

export type CompanyLookupMode = "all" | "sp500-only" | "exclude-sp500";

export interface CompanyLookupOptions {
  mode?: CompanyLookupMode;
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
 * Build a CIK -> Company info lookup from a publicCompaniesQuery result,
 * optionally filtered by SP500 membership.
 */
export function buildCompanyLookup(
  result: any,
  options?: CompanyLookupOptions,
): Map<string, { id: string; name: string; isSp500: boolean }> {
  const mode = options?.mode ?? "all";
  const companies = (result?.company ?? []) as any[];
  const lookup = new Map<
    string,
    { id: string; name: string; isSp500: boolean }
  >();

  for (const company of companies) {
    const cik = company?.identity?.primaryCIK;
    if (!cik) continue;

    const isSp500 = Boolean(company?.identity?.sp500);

    if (mode === "sp500-only" && !isSp500) continue;
    if (mode === "exclude-sp500" && isSp500) continue;

    lookup.set(cik, { id: company.id, name: company.name, isSp500 });
  }

  return lookup;
}
