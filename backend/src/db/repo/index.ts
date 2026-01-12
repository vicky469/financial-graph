import type {
  Company,
  ParentOfEdge,
  Filing,
  SubsidiaryEnrichment,
} from "@financial-graph/shared";
import {
  upsertCompany,
  linkParentChild,
  getCompanyIdByCik,
} from "./companies";
import { upsertBusinessSegment } from "./segments";
import { upsertBrand } from "./brands";
import { upsertFiling } from "./filings";
import {
  createEnrichment,
  queryUnenriched,
  markEnriched,
  clearEnrichment,
} from "./enrichments";

// Re-export for standalone usage
export * from "./companies";
export * from "./segments";
export * from "./brands";
export * from "./filings";
export * from "./enrichments";

export class FinancialGraphRepository {
  async upsertCompany(companyData: Partial<Company>): Promise<string> {
    return upsertCompany(companyData);
  }

  async linkParentChild(
    parentId: string,
    childId: string,
    customProps: Partial<ParentOfEdge> = {}
  ): Promise<string> {
    return linkParentChild(parentId, childId, customProps);
  }

  async upsertFiling(filingData: Partial<Filing> & { company_id: string }): Promise<string> {
    return upsertFiling(filingData);
  }

  getCompanyIdByCik(cik: string): string {
    return getCompanyIdByCik(cik);
  }

  async createEnrichment(data: {
    company_id: string;
    filing_id: string;
    footnoteRefs: string[];
    footnotesHtml: string | null;
  }): Promise<string> {
    return createEnrichment(data);
  }

  async queryUnenriched(options?: {
    limit?: number;
    filing_id?: string;
  }): Promise<SubsidiaryEnrichment[]> {
    return queryUnenriched(options);
  }

  async markEnriched(enrichment_id: string): Promise<void> {
    return markEnriched(enrichment_id);
  }

  async clearEnrichment(enrichment_id: string): Promise<void> {
    return clearEnrichment(enrichment_id);
  }
}
