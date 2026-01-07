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

// Load ALL companies (minimal data only: id, name, ticker, cik)
// Client-side search is faster than database search
export const useAllCompanies = () => {
  const { data, isLoading } = db.useQuery({
    companies: {},
  });

  console.log("useAllCompanies debug:", {
    isLoading,
    dataCompaniesLength: data?.companies?.length ?? 0,
    sampleData: data?.companies?.slice(0, 2),
  });

  const companies = (data?.companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    type: "Company" as const,
    ticker: c.identity?.tickers?.[0] ?? null,
    cik: c.identity?.cik ?? null,
  }));

  console.log("useAllCompanies result:", {
    companiesLength: companies.length,
    sampleCompanies: companies.slice(0, 2),
  });

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
                or: [
                  { from_company_id: companyId },
                  { to_company_id: companyId },
                ],
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
      : null as any
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
  const ownsEdges = (data?.owns ?? []).map((o) =>
    ownsToEdge(o as unknown as Owns)
  );
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
      : null as any
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
      : null as any
  );

  const company = data?.companies?.[0];
  if (!company) return { node: null, isLoading };

  const node = companyToNode(company as unknown as Company);
  return { node, isLoading };
};
