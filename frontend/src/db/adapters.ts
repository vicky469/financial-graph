// Adapters to transform backend schema (companies, brands, parent_of, etc.)
// into frontend node/edge format

import type { Node, Edge } from "../types";
import type { Company, Brand, ParentOf, Owns } from "@financial-graph/shared";

// Re-export for convenience
export type { Company, Brand, ParentOf, Owns };

// Transform a backend company to a frontend node
export function companyToNode(company: Company): Node {
  const createdAt = new Date(company.created_at).getTime();
  const updatedAt = new Date(company.updated_at).getTime();
  const validFrom = company.founded_date
    ? new Date(company.founded_date).getTime()
    : undefined;

  return {
    id: company.id,
    name: company.name,
    type: "Company",
    properties: {
      type: company.type,
      ...(company.identity?.tickers && {
        tickers: company.identity.tickers.join(", "),
      }),
      ...(company.identity?.exchange && { exchange: company.identity.exchange }),
    },
    jurisdiction: company.jurisdiction_iso || company.jurisdiction_raw || undefined,
    cik: company.identity?.cik,
    validFrom,
    createdAt,
    createdBy: "system", // Backend doesn't track user, default to system
    updatedAt,
    updatedBy: "system",
  };
}

// Transform a backend brand to a frontend node
export function brandToNode(brand: Brand): Node {
  const createdAt = new Date(brand.created_at).getTime();
  const updatedAt = new Date(brand.updated_at).getTime();
  const validFrom = brand.launch_date
    ? new Date(brand.launch_date).getTime()
    : undefined;

  return {
    id: brand.id,
    name: brand.name,
    type: "Brand",
    properties: {
      ...(brand.category && { category: brand.category }),
      status: brand.status,
      company_id: brand.owning_company_id,
    },
    validFrom,
    createdAt,
    createdBy: "system",
    updatedAt,
    updatedBy: "system",
  };
}

// Transform a backend parent_of relationship to a frontend edge
export function parentOfToEdge(parentOf: ParentOf): Edge {
  const createdAt = new Date(parentOf.created_at).getTime();
  const updatedAt = new Date(parentOf.updated_at).getTime();
  const validFrom = new Date(parentOf.established_date).getTime();
  const validTo = parentOf.ended_date
    ? new Date(parentOf.ended_date).getTime()
    : undefined;

  return {
    id: parentOf.id,
    sourceId: parentOf.from_company_id,
    targetId: parentOf.to_company_id,
    label: "parent_of",
    edgeType: "causal",
    ownership: parentOf.ownership_percent || undefined,
    validFrom,
    validTo,
    createdAt,
    createdBy: "system",
    updatedAt,
    updatedBy: "system",
  };
}

// Transform a backend owns relationship to a frontend edge
export function ownsToEdge(owns: Owns): Edge {
  const createdAt = new Date(owns.created_at).getTime();
  const updatedAt = new Date(owns.updated_at).getTime();
  const validFrom = owns.acquired_date
    ? new Date(owns.acquired_date).getTime()
    : createdAt;
  const validTo = owns.divested_date
    ? new Date(owns.divested_date).getTime()
    : undefined;

  return {
    id: owns.id,
    sourceId: owns.from_company_id,
    targetId: owns.to_brand_id,
    label: "owns",
    edgeType: "causal",
    validFrom,
    validTo,
    createdAt,
    createdBy: "system",
    updatedAt,
    updatedBy: "system",
  };
}
