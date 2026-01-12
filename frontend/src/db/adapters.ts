// Adapters to transform backend schema (companies, parent_of, etc.)
// into frontend node/edge format

import type { Node, Edge } from "../types";
import type { Company, ParentOfEdge } from "@financial-graph/shared";

// Transform a backend company to a frontend node
export function companyToNode(company: Company): Node {
  const updatedAt = new Date(company.updated_at).getTime();

  return {
    id: company.id,
    name: company.name,
    type: "Company",
    properties: {
      type: company.type,
      ...(company.identity?.tickers && {
        tickers: company.identity.tickers,
      }),
      ...(company.identity?.exchanges && { exchange: company.identity.exchanges }),
    },
    jurisdiction: company.jurisdiction_iso || company.jurisdiction_raw || undefined,
    cik: company.identity?.primaryCIK,
    updatedAt,
    updatedBy: "system",
  };
}

// Transform a backend parent_of relationship to a frontend edge
// Note: parentCompany and subsidiaryCompany must be populated via InstantDB links
export function parentOfToEdge(
  parentOf: ParentOfEdge & { 
    parentCompany?: { id: string }; 
    subsidiaryCompany?: { id: string };
  }
): Edge {
  const updatedAt = new Date(parentOf.updated_at).getTime();
  const validFrom = parentOf.established_date
    ? new Date(parentOf.established_date).getTime()
    : undefined;
  const validTo = parentOf.ended_date
    ? new Date(parentOf.ended_date).getTime()
    : undefined;

  if (!parentOf.parentCompany?.id || !parentOf.subsidiaryCompany?.id) {
    throw new Error("parentOfToEdge requires parentCompany and subsidiaryCompany to be populated");
  }

  return {
    id: parentOf.id,
    sourceId: parentOf.parentCompany.id,
    targetId: parentOf.subsidiaryCompany.id,
    label: "parent_of",
    edgeType: "causal",
    ownership: parentOf.ownership_percent || undefined,
    validFrom,
    validTo,
    updatedAt,
    updatedBy: "system",
  };
}
