import { db } from "../client";
import {
  CompanyType,
  CompanySchema,
  validate,
  ParentOfSource,
  generateCompanyId,
  generateCompanyInfoId,
  generateParentOfId,
  type Company,
  type ParentOfEdge,
} from "@financial-graph/shared";

/**
 * Upsert a company
 *
 * For PUBLIC/ISSUER companies:
 * - Uses identity.primaryCIK for ID generation
 * - Assumes one legal entity per CIK
 */
export async function upsertCompany(
  companyData: Partial<Company>,
): Promise<string> {
  // Ensure type is set for ID generation
  const companyType = companyData.type ?? CompanyType.PRIVATE;

  // Generate ID (uses primaryCIK for PUBLIC/ISSUER)
  const id = generateCompanyId({
    ...companyData,
    type: companyType,
  });

  // Prepare full node data
  const node: Company = {
    id,
    name: companyData.name!,
    aliases: companyData.aliases || [],
    type: companyType,
    jurisdiction_iso: companyData.jurisdiction_iso ?? undefined,
    jurisdiction_raw: companyData.jurisdiction_raw ?? undefined,
    identity: companyData.identity
      ? {
          primaryCIK: companyData.identity.primaryCIK,
          tickers: companyData.identity.tickers,
          exchanges: companyData.identity.exchanges,
          sp500: companyData.identity.sp500,
          lei: companyData.identity.lei,
          duns: companyData.identity.duns,
          entityType: companyData.identity.entityType,
          sic: companyData.identity.sic,
          sicDescription: companyData.identity.sicDescription,
          ein: companyData.identity.ein,
          category: companyData.identity.category,
          ownerOrg: companyData.identity.ownerOrg,
        }
      : undefined,
    updated_at: new Date().toISOString(),
  };

  // Validate business logic (type-specific rules)
  validate(CompanySchema, node);

  // Upsert to InstantDB
  await db.transact([db.tx.company[id].update(node)]);

  return id;
}

export async function linkParentChild(
  parentId: string,
  childId: string,
  customProps: Partial<ParentOfEdge> = {},
): Promise<string> {
  const established_date =
    customProps.established_date || new Date().toISOString();
  const edgeId = generateParentOfId(parentId, childId);

  const edge = {
    id: edgeId,
    ownership_percent: customProps.ownership_percent ?? undefined,
    established_date,
    ended_date: customProps.ended_date ?? undefined,
    source: customProps.source || ParentOfSource.MANUAL,
    updated_at: new Date().toISOString(),
  };

  await db.transact([
    db.tx.parent_of[edgeId].update(edge),
    db.tx.company[parentId].link({ subsidiaries: edgeId }),
    db.tx.company[childId].link({ parents: edgeId }),
  ]);

  return edgeId;
}

/**
 * Get company ID by CIK using deterministic ID generation
 *
 * @param cik - CIK string (will be normalized to 10 digits)
 * @returns UUID v5 company ID
 */
export function getCompanyIdByCik(cik: string): string {
  const normalizedCik = cik.padStart(10, "0");
  return generateCompanyId({
    type: CompanyType.PUBLIC,
    name: "placeholder", // Required by schema but not used for PUBLIC companies
    identity: { primaryCIK: normalizedCik },
  });
}

/**
 * Upsert company info (1:1 link with company)
 */
export async function upsertCompanyInfo(
  companyId: string,
  infoData: {
    fiscal_year_end?: string;
    addresses?: any;
    phone?: string;
    former_names?: any;
  },
): Promise<string> {
  const id = generateCompanyInfoId(companyId);

  const node = {
    id,
    ...infoData,
    updated_at: new Date().toISOString(),
  };

  await db.transact([
    db.tx.company_info[id].update(node),
    db.tx.company[companyId].link({ companyInfo: id }),
  ]);

  return id;
}
