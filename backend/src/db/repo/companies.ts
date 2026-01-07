import { db } from "../client";
import * as IDs from "../ids";
import type * as Types from "../../types";
import {
  CompanySchema,
  PublicCompanyDetailsSchema,
  ParentOfEdgeSchema,
  HasPublicDetailsEdgeSchema,
  validate,
} from "../validation";

export async function upsertCompany(
  companyData: Partial<Types.Company>
): Promise<string> {
  // 1. Validate & Normalize
  let id: string;

  if (
    (companyData.type === "public" || companyData.type === "issuer") &&
    companyData.identity?.cik
  ) {
    // Rule: CIK must be 10 digits
    companyData.identity.cik = String(companyData.identity.cik).padStart(
      10,
      "0"
    );
  }

  // 2. Generate ID
  id = IDs.generateCompanyId(companyData);

  // 3. Prepare full node data
  const node: Types.Company = {
    id,
    name: companyData.name!,
    aliases: companyData.aliases || [],
    type: companyData.type || "private",
    parent_company_id: companyData.parent_company_id || null,
    founded_date: companyData.founded_date || null,
    jurisdiction_iso: companyData.jurisdiction_iso || null,
    jurisdiction_raw: companyData.jurisdiction_raw ?? null,
    identity: {
      tickers: companyData.identity?.tickers,
      cik: companyData.identity?.cik,
      exchange: companyData.identity?.exchange,
      lei: companyData.identity?.lei,
      duns: companyData.identity?.duns,
    },
    created_at: companyData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate before inserting
  const validatedNode = validate(CompanySchema, node);

  // 4. Upsert to InstantDB
  await db.transact([db.tx.companies[id].update(validatedNode)]);

  return id;
}

export async function upsertPublicCompanyDetails(
  detailsData: Partial<Types.PublicCompanyDetails>
): Promise<string> {
  const company_id = detailsData.company_id!;
  const id = IDs.generatePublicCompanyDetailsId(company_id);

  const node: Types.PublicCompanyDetails = {
    id,
    company_id,
    sic_code: detailsData.sic_code || null,
    industry_sector: detailsData.industry_sector || null,
    fiscal_year_end: detailsData.fiscal_year_end || null,
    created_at: detailsData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate before inserting
  const validatedNode = validate(PublicCompanyDetailsSchema, node);

  // Also create the edge
  const edgeId = IDs.generateHasPublicDetailsEdgeId(company_id, id);
  const edge: Types.HasPublicDetailsEdge = {
    id: edgeId,
    from_company_id: company_id,
    to_details_id: id,
    created_at: new Date().toISOString(),
  };

  // Validate edge
  const validatedEdge = validate(HasPublicDetailsEdgeSchema, edge);

  await db.transact([
    db.tx.public_company_details[id].update(validatedNode),
    db.tx.has_public_details[edgeId].update(validatedEdge),
    // Link nodes (InstantDB linking syntax might differ based on SDK version,
    // but standard admin SDK usually supports linking via update of edge or link method.
    // Assuming standard triple storage where edge node is sufficient or implicit linking)
    db.tx.companies[company_id].link({ public_details: id }),
    // Reverse link if needed
    db.tx.public_company_details[id].link({ company: company_id }),
  ]);

  return id;
}

export async function linkParentChild(
  parentId: string,
  childId: string,
  customProps: Partial<Types.ParentOfEdge> = {}
): Promise<string> {
  const established_date =
    customProps.established_date || new Date().toISOString();
  const edgeId = IDs.generateParentOfEdgeId({
    from_company_id: parentId,
    to_company_id: childId,
    established_date,
  });

  const edge: Types.ParentOfEdge = {
    id: edgeId,
    from_company_id: parentId,
    to_company_id: childId,
    ownership_percent: customProps.ownership_percent || null,
    established_date,
    ended_date: customProps.ended_date || null,
    source: customProps.source || "manual",
    source_id: customProps.source_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate edge before inserting
  const validatedEdge = validate(ParentOfEdgeSchema, edge);

  await db.transact([
    db.tx.parent_of[edgeId].update(validatedEdge),
    db.tx.companies[parentId].link({ subsidiaries: childId }),
    db.tx.companies[childId].link({ parent: parentId }),
  ]);

  return edgeId;
}

export function getCompanyIdByCik(cik: string): string {
  return IDs.generateCompanyId({
    type: "public",
    identity: { cik },
  });
}
