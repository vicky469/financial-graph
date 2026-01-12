import type * as Types from "../../types";
import {
  upsertCompany,
  upsertPublicInfo,
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
  async upsertCompany(companyData: Partial<Types.Company>): Promise<string> {
    return upsertCompany(companyData);
  }

  async upsertPublicInfo(
    detailsData: Partial<Types.PublicInfo>
  ): Promise<string> {
    return upsertPublicInfo(detailsData);
  }

  async upsertBusinessSegment(
    segmentData: Partial<Types.BusinessSegment>
  ): Promise<string> {
    return upsertBusinessSegment(segmentData);
  }

  async upsertBrand(brandData: Partial<Types.Brand>): Promise<string> {
    return upsertBrand(brandData);
  }

  async linkParentChild(
    parentId: string,
    childId: string,
    customProps: Partial<Types.ParentOfEdge> = {}
  ): Promise<string> {
    return linkParentChild(parentId, childId, customProps);
  }

  async upsertFiling(filingData: Partial<Types.Filing>): Promise<string> {
    return upsertFiling(filingData);
  }

  async getCompanyIdByCik(cik: string): Promise<string> {
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
  }): Promise<Types.SubsidiaryEnrichment[]> {
    return queryUnenriched(options);
  }

  async markEnriched(enrichment_id: string): Promise<void> {
    return markEnriched(enrichment_id);
  }

  async clearEnrichment(enrichment_id: string): Promise<void> {
    return clearEnrichment(enrichment_id);
  }
}
