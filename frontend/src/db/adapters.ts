// Adapters to transform backend data into frontend types

import type { CompanyDetail } from "../types/domain";
import type { Company } from "financial-graph-shared";

// Transform a backend company to a frontend CompanyDetail
export function companyToDetail(company: Company & { companyInfo?: unknown }): CompanyDetail {
  // Handle companyInfo which might be an object (has: 'one') or array depending on client behavior
  const rawInfo = (company as unknown as { companyInfo?: unknown }).companyInfo;
  const companyInfo = Array.isArray(rawInfo) ? rawInfo[0] : rawInfo;

  return {
    ...company,
    // Add convenience fields
    cik: company.identity?.primaryCIK,
    jurisdiction: company.jurisdiction_iso || company.jurisdiction_raw,
    // Add companyInfo relation
    companyInfo: companyInfo
      ? {
          fiscal_year_end: (companyInfo as { fiscal_year_end?: string }).fiscal_year_end,
          addresses: (companyInfo as { addresses?: unknown }).addresses,
          phone: (companyInfo as { phone?: string }).phone,
          former_names: (companyInfo as { former_names?: unknown }).former_names,
          updated_at: (companyInfo as { updated_at?: string }).updated_at,
        }
      : undefined,
  };
}
