import type { Company, ParentOfEdge, Filing } from "@financial-graph/shared";
import { upsertCompany, linkParentChild, getCompanyIdByCik } from "./companies";
import { upsertFiling } from "./filings";

// Re-export for standalone usage
export * from "./companies";
export * from "./filings";

export class FinancialGraphRepository {
  async upsertCompany(companyData: Partial<Company>): Promise<string> {
    return upsertCompany(companyData);
  }

  async linkParentChild(
    parentId: string,
    childId: string,
    customProps: Partial<ParentOfEdge> = {},
  ): Promise<string> {
    return linkParentChild(parentId, childId, customProps);
  }

  async upsertFiling(
    filingData: Partial<Filing> & { company_id: string },
  ): Promise<string> {
    return upsertFiling(filingData);
  }

  getCompanyIdByCik(cik: string): string {
    return getCompanyIdByCik(cik);
  }
}
