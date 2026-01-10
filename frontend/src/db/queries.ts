// Shared Query Hooks

import { db } from "./client";
import {
  companyToNode,
  parentOfToEdge,
  ownsToEdge,
  type Company,
  type ParentOf,
  type Owns,
} from "./adapters";
import type { Node } from "../types";

// Load ALL public companies: id, name, ticker, cik)
// Client-side search is faster than database search
export const useAllCompanies = () => {
  const { data, isLoading } = db.useQuery({
    companies: {
      $: {
        where: {
          type: "public",
        },
      },
    },
  });

  const companies = (data?.companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    type: "Company" as const,
    ticker: c.identity?.tickers?.[0] ?? null,
    cik: c.identity?.cik ?? null,
  }));

  return { companies, isLoading };
};

// Load only edges needed for a specific company
export const useCompanyGraph = (companyId: string | null) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          companies: {
            $: {
              where: {
                id: companyId,
              },
            },
          },
          parent_of: {
            $: {
              where: {
                or: [{ from_company_id: companyId }, { to_company_id: companyId }],
              },
            },
          },
          owns: {
            $: {
              where: {
                from_company_id: companyId,
              },
            },
          },
        }
      : (null as any)
  );

  const nodes: Node[] = [];
  const edges = [];

  if (data?.companies?.[0]) {
    nodes.push({
      id: data.companies[0].id,
      name: data.companies[0].name,
      type: "Company",
      properties: {
        ...(data.companies[0].identity?.tickers && {
          tickers: data.companies[0].identity.tickers.join(", "),
        }),
      },
      cik: data.companies[0].identity?.cik,
      createdAt: Date.now(),
      createdBy: "system",
    });
  }

  // Add edges
  const parentOfEdges = (data?.parent_of ?? []).map((p) =>
    parentOfToEdge(p as unknown as ParentOf)
  );
  const ownsEdges = (data?.owns ?? []).map((o) => ownsToEdge(o as unknown as Owns));
  edges.push(...parentOfEdges, ...ownsEdges);

  return { nodes, edges, isLoading };
};

// Fetch subsidiaries for a company
export const useCompanySubsidiaries = (companyId: string | null) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          parent_of: {
            $: {
              where: {
                from_company_id: companyId,
              },
            },
          },
          companies: {},
        }
      : (null as any)
  );

  const subsidiaryIds = new Set((data?.parent_of ?? []).map((p) => p.to_company_id));
  const subsidiaries = (data?.companies ?? [])
    .filter((c) => subsidiaryIds.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      cik: c.identity?.cik,
    }));

  return { subsidiaries, isLoading };
};

// Fetch brands for a company
export const useCompanyBrands = (companyId: string | null) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          owns: {
            $: {
              where: {
                from_company_id: companyId,
              },
            },
          },
          brands: {},
        }
      : (null as any)
  );

  const brandIds = new Set((data?.owns ?? []).map((o) => o.to_brand_id));
  const brands = (data?.brands ?? [])
    .filter((b) => brandIds.has(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      status: b.status,
    }));

  return { brands, isLoading };
};

// Fetch SEC filings for a company (query directly from filings table)
export const useCompanyFilings = (companyId: string | null) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          filings: {
            $: {
              where: {
                company_id: companyId,
              },
            },
          },
        }
      : (null as any)
  );

  const filings = (data?.filings ?? [])
    .map((f) => {
      const attachments = f.attachments as Record<string, string> | null;

      return {
        id: f.id,
        formType: f.form_type,
        filingDate: f.filing_date,
        fiscalYear: f.fiscal_year,
        fileUrl: f.file_url,
        attachments: attachments || {},
      };
    })
    .sort((a, b) => {
      // Sort by fiscal year desc, then by filing date desc
      if (b.fiscalYear !== a.fiscalYear) {
        return (b.fiscalYear || 0) - (a.fiscalYear || 0);
      }
      return b.filingDate.localeCompare(a.filingDate);
    });

  return { filings, isLoading };
};

// Fetch full details for a specific company when needed
export const useCompanyDetails = (companyId: string | null) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          companies: {
            $: {
              where: {
                id: companyId,
              },
            },
          },
        }
      : (null as any)
  );

  const company = data?.companies?.[0];
  if (!company) return { node: null, isLoading };

  const node = companyToNode(company as unknown as Company);
  return { node, isLoading };
};

// Fetch audit trail for a company
export const useCompanyAudits = (entityId: string | null) => {
  const { data, isLoading } = db.useQuery(
    entityId
      ? {
          audits: {
            $: {
              where: {
                entity_type: "companies",
                entity_id: entityId,
              },
              order: {
                serverCreatedAt: "desc",
              },
            },
          },
        }
      : (null as any)
  );

  const audits = (data?.audits ?? []).map((a) => ({
    id: a.id,
    entity_type: a.entity_type,
    entity_id: a.entity_id,
    operation: a.operation as "CREATE" | "UPDATE" | "DELETE",
    changed_by: a.changed_by as "heuristic" | "llm" | "human",
    changed_at: a.changed_at,
    source_id: a.source_id,
    fields_changed: a.fields_changed as Array<{
      field: string;
      old_value: unknown;
      new_value: unknown;
    }>,
    expires_at: a.expires_at,
  }));

  return { audits, isLoading };
};
