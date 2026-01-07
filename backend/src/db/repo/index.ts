import type * as Types from "../../types";
import {
  upsertCompany,
  upsertPublicCompanyDetails,
  linkParentChild,
  getCompanyIdByCik,
} from "./companies";
import { upsertBusinessSegment } from "./segments";
import { upsertBrand } from "./brands";
import { upsertFiling } from "./filings";

// Re-export for standalone usage
export * from "./companies";
export * from "./segments";
export * from "./brands";
export * from "./filings";

export class FinancialGraphRepository {
  async upsertCompany(companyData: Partial<Types.Company>): Promise<string> {
    return upsertCompany(companyData);
  }

  async upsertPublicCompanyDetails(
    detailsData: Partial<Types.PublicCompanyDetails>
  ): Promise<string> {
    return upsertPublicCompanyDetails(detailsData);
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
}
