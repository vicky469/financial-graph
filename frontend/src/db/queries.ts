// Shared Query Hooks

import { db } from "./client";
import { companyToNode } from "./adapters";
import type { Node } from "../types";
import { CompanyType, type Company } from "@financial-graph/shared";

// Load ALL public companies (lightweight - just id, name, type)
// Excludes ISSUER and TRUST companies
export const useAllCompanies = () => {
  const { data, isLoading } = db.useQuery({
    company: {
      $: {
        where: {
          type: CompanyType.PUBLIC, // Only PUBLIC companies
        }
      },
    },
  });

  const companies = (data?.company ?? [])
    .filter((c: any) => c.name && c.name.trim() !== "") // Filter out empty names
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      type: "Company" as const,
      ticker: c.identity?.tickers?.split(',')[0]?.trim() ?? null,
      cik: c.identity?.primaryCIK ?? null,
    }));

  return { companies, isLoading };
};

// Load only edges needed for a specific company
export const useCompanyGraph = (companyId: string | null) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          company: {
            $: {
              where: {
                id: companyId,
              },
            },
            subsidiaries: {}, // Use the link to get parent_of edges where this company is the parent
          },
        }
      : null
  );

  const nodes: Node[] = [];
  const edges: any[] = [];

  if (data?.company?.[0]) {
    const company = data.company[0];
    nodes.push({
      id: company.id,
      name: company.name,
      type: "Company",
      properties: {
        ...(company.identity?.tickers && {
          tickers: company.identity.tickers,
        }),
      },
      cik: company.identity?.primaryCIK,
      updatedAt: Date.now(),
      updatedBy: "system",
    });

    // Add subsidiary edges
    if (company.subsidiaries) {
      edges.push(...company.subsidiaries.map((edge: any) => ({
        id: edge.id,
        sourceId: companyId,
        targetId: edge.subsidiaryCompany?.id,
        label: "parent_of",
        ownership: edge.ownership_percent,
        updatedAt: Date.now(),
        updatedBy: "system",
      })));
    }
  }

  return { nodes, edges, isLoading };
};

// Fetch subsidiaries for a company with hierarchical structure
export const useCompanySubsidiaries = (companyId: string | null) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          company: {
            $: {
              where: {
                id: companyId,
              },
            },
            subsidiaries: {
              subsidiaryCompany: {}, // Get the actual subsidiary company data
            },
          },
        }
      : null
  );

  const company = data?.company?.[0];
  const edges = company?.subsidiaries || [];
  
  // Build company map from subsidiary edges
  const companyMap = new Map();
  if (company) {
    companyMap.set(company.id, company);
  }
  edges.forEach((edge: any) => {
    if (edge.subsidiaryCompany) {
      companyMap.set(edge.subsidiaryCompany.id, edge.subsidiaryCompany);
    }
  });

  // Build tree structure recursively
  const buildTree = (parentId: string): any[] => {
    const childEdges = edges.filter((e: any) => e.subsidiaryCompany?.id);
    
    return childEdges.map((edge: any) => {
      const child = edge.subsidiaryCompany;
      if (!child) return null;

      return {
        id: child.id,
        name: child.name,
        ownership_percent: edge.ownership_percent,
        children: [], // TODO: Implement recursive loading
      };
    }).filter(Boolean);
  };

  const subsidiaryTree = companyId ? buildTree(companyId) : [];

  // Flat list for backward compatibility
  const subsidiariesList = edges.map((edge: any) => {
    const child = edge.subsidiaryCompany;
    return child ? {
      id: child.id,
      name: child.name,
      cik: child.identity?.primaryCIK,
    } : null;
  }).filter(Boolean);

  return { 
    subsidiaries: subsidiariesList, 
    subsidiaryTree, 
    isLoading 
  };
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
          brand: {},
        }
      : null
  );

  const brandIds = new Set((data?.owns ?? []).map((o: any) => o.to_brand_id));
  const brands = (data?.brand ?? [])
    .filter((b: any) => brandIds.has(b.id))
    .map((b: any) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      status: b.status,
    }));

  return { brands, isLoading };
};

// Fetch SEC filings for a company (query through link)
export const useCompanyFilings = (companyId: string | null) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          company: {
            $: {
              where: {
                id: companyId,
              },
            },
            filings: {}, // Use the link to get filings
          },
        }
      : null
  );

  const company = data?.company?.[0];
  const filings = (company?.filings ?? [])
    .map((f: any) => {
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
    .sort((a: any, b: any) => {
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
          company: {
            $: {
              where: {
                id: companyId,
              },
            },
          },
        }
      : null
  );

  const company = data?.company?.[0];
  if (!company) return { node: null, isLoading };

  const node = companyToNode(company as unknown as Company);
  return { node, isLoading };
};

// Fetch audit trail for a company
export const useCompanyAudits = (entityId: string | null) => {
  const { data, isLoading } = db.useQuery(
    entityId
      ? {
          audit: {
            $: {
              where: {
                entity_type: "company",
                entity_id: entityId,
              },
              order: {
                changed_at: "desc",
              },
            },
          },
        }
      : null
  );

  const audits = (data?.audit ?? []).map((a: any) => ({
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
