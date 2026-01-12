import { db } from "../client";
import * as IDs from "../ids";
import type * as Types from "../../types";
import {
  CompanySchema,
  PublicInfoSchema,
  ParentOfEdgeSchema,
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
    // Rule: CIK must be 10 digits - normalize all CIKs in the array
    companyData.identity.cik = companyData.identity.cik.map((cik) =>
      String(cik).padStart(10, "0")
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

export async function upsertPublicInfo(
  detailsData: Partial<Types.PublicInfo>
): Promise<string> {
  const company_id = detailsData.company_id!;
  const id = IDs.generatePublicInfoId(company_id);

  const node: Types.PublicInfo = {
    id,
    company_id,
    sic_code: detailsData.sic_code || null,
    industry_sector: detailsData.industry_sector || null,
    fiscal_year_end: detailsData.fiscal_year_end || null,
    created_at: detailsData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Validate before inserting
  const validatedNode = validate(PublicInfoSchema, node);

  await db.transact([
    db.tx.public_info[id].update(validatedNode),
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
    identity: { cik: [cik] }, // CIK is now an array
  });
}
