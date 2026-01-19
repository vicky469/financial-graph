// Shared Query Hooks

import { useMemo, useEffect } from "react";
import { db } from "./client";
import { companyToNode } from "./adapters";
import type { Node } from "../types";
import { CompanyType, type Company } from "@financial-graph/shared";

// Simple in-memory cache for companies
const companiesCache = {
  data: null as Array<{
    id: string;
    name: string;
    type: "Company";
    ticker: string | null;
    cik: string | null;
    sp500: boolean;
  }> | null,
  timestamp: 0,
  TTL: 5 * 60 * 1000, // 5 minutes cache
};

// Load all public companies (lightweight - just id, name, type, sp500 flag)
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

  const companies = useMemo(() => {
    if (!data?.company) return [];
    
    return (data.company ?? [])
      .filter((c: any) => {
        // Filter out empty names
        return c.name && c.name.trim() !== "";
      })
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        type: "Company" as const,
        ticker: c.identity?.tickers?.split(',')[0]?.trim() ?? null,
        cik: c.identity?.primaryCIK ?? null,
        sp500: c.identity?.sp500 === true,
      }));
  }, [data?.company]);

  // Cache all public companies when loaded
  useEffect(() => {
    if (companies.length > 0) {
      companiesCache.data = companies;
      companiesCache.timestamp = Date.now();
    }
  }, [companies]);

  return { companies, isLoading };
};

// Cached version that returns cached data immediately if available
export const useAllCompaniesCached = () => {
  const cacheTimestamp = companiesCache.timestamp;
  const isCacheValid = companiesCache.data && (Date.now() - cacheTimestamp) < companiesCache.TTL;
  
  // Always call the hook, but conditionally use the data
  const { companies: freshCompanies, isLoading } = useAllCompanies();
  
  // If cache is valid, return cached data immediately
  if (isCacheValid) {
    return { companies: companiesCache.data!, isLoading: false };
  }
  
  // Otherwise, return fresh data
  return { companies: freshCompanies, isLoading };
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

  // Build hierarchical tree structure based on actual parent-child relationships
  const buildHierarchicalTree = (parentId: string, processedIds = new Set()): any[] => {
    // Prevent infinite loops
    if (processedIds.has(parentId)) {
      return [];
    }
    processedIds.add(parentId);

    // Find all direct children of this parent
    const childEdges = edges.filter((edge: any) => {
      // Check if this edge represents a parent-child relationship where parentId is the parent
      // Since we're querying from the parent company, all edges should have the parent as the source
      return edge.subsidiaryCompany?.id && !processedIds.has(edge.subsidiaryCompany.id);
    });
    
    return childEdges.map((edge: any) => {
      const child = edge.subsidiaryCompany;
      if (!child) return null;

      return {
        id: child.id,
        name: child.name,
        ownership_percent: edge.ownership_percent,
        jurisdiction: child.jurisdiction_raw || child.jurisdiction_iso || "Unknown",
        parentId: parentId,
        parentName: company?.name,
        children: [], // TODO: Implement recursive subsidiary querying for true multi-level
        level: 1, // Direct subsidiaries are level 1
      };
    }).filter(Boolean);
  };

  const subsidiaryTree = companyId ? buildHierarchicalTree(companyId) : [];

  // Enhanced flat list with hierarchy information
  const subsidiariesList = edges.map((edge: any) => {
    const child = edge.subsidiaryCompany;
    return child ? {
      id: child.id,
      name: child.name,
      cik: child.identity?.primaryCIK,
      jurisdiction: child.jurisdiction_raw || child.jurisdiction_iso || "Unknown",
      ownership_percent: edge.ownership_percent,
      parentCompanyId: companyId,
      parentCompanyName: company?.name,
      level: 1, // All are direct subsidiaries for now
    } : null;
  }).filter(Boolean);

  return { 
    subsidiaries: subsidiariesList, 
    subsidiaryTree, 
    isLoading 
  };
};

// New query to get full hierarchical structure by recursively fetching subsidiary relationships
export const useCompanyHierarchy = (companyId: string | null) => {
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
              subsidiaryCompany: {
                // Get subsidiaries of subsidiaries (2 levels deep)
                subsidiaries: {
                  subsidiaryCompany: {
                    // Get subsidiaries of subsidiaries of subsidiaries (3 levels deep)
                    subsidiaries: {
                      subsidiaryCompany: {},
                    },
                  },
                },
              },
            },
          },
        }
      : null
  );

  const company = data?.company?.[0];
  const directSubsidiaries = company?.subsidiaries || [];
  
  // Build a multi-level hierarchy tree from nested subsidiary relationships
  const buildNestedHierarchy = (rootCompany: any, level = 0): any => {
    if (!rootCompany) return null;

    // Get subsidiaries at this level
    const subsidiaryEdges = level === 0 ? directSubsidiaries : (rootCompany.subsidiaries || []);
    
    const children = subsidiaryEdges.map((edge: any) => {
      const child = edge.subsidiaryCompany;
      if (!child) return null;

      // Recursively build children
      return buildNestedHierarchy({
        ...child,
        subsidiaries: child.subsidiaries || [],
      }, level + 1);
    }).filter(Boolean);

    return {
      id: rootCompany.id,
      name: rootCompany.name,
      jurisdiction: rootCompany.jurisdiction_raw || rootCompany.jurisdiction_iso || "Unknown",
      level,
      children,
      ownership_percent: level > 0 ? rootCompany.ownership_percent : null,
    };
  };

  const hierarchyTree = company
    ? buildNestedHierarchy(company)
    : null;

  // Flatten the hierarchy for list view with proper indentation levels
  const flattenHierarchy = (node: any, result: any[] = []): any[] => {
    if (!node) return result;
    
    result.push({
      id: node.id,
      name: node.name,
      jurisdiction: node.jurisdiction,
      level: node.level,
      ownership_percent: node.ownership_percent,
      hasChildren: node.children && node.children.length > 0,
    });

    // Add children recursively
    if (node.children) {
      node.children.forEach((child: any) => {
        flattenHierarchy(child, result);
      });
    }

    return result;
  };

  const flatHierarchy = hierarchyTree ? flattenHierarchy(hierarchyTree) : [];

  return {
    hierarchyTree,
    flatHierarchy,
    isLoading,
  };
};

// Fetch brands for a company (disabled - brand entities are commented out in schema)
export const useCompanyBrands = (_companyId: string | null) => {
  // Return empty brands since brand/owns entities are not active in schema
  return { brands: [] as { id: string; name: string; status: string; category?: string }[], isLoading: false };
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
        periodOfReport: f.period_of_report,
        fileUrl: f.file_url,
        attachments: attachments || {},
      };
    })
    .sort((a: any, b: any) => {
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

// Fetch subsidiary details including parent relationship - OPTIMIZED
export const useSubsidiaryDetails = (subsidiaryId: string | null, parentCompanyId?: string | null) => {
  const { data, isLoading } = db.useQuery(
    subsidiaryId
      ? {
          company: {
            $: {
              where: {
                id: subsidiaryId,
              },
            },
            // Use the reverse link to get parent relationships directly
            parents: {
              parentCompany: {},
            },
          },
        }
      : null
  );

  const subsidiary = data?.company?.[0];
  // Get the first parent relationship (there should typically be only one)
  const parentEdge = subsidiary?.parents?.[0];

  if (!subsidiary) return { subsidiary: null, parentEdge: null, isLoading };

  return { 
    subsidiary: {
      id: subsidiary.id,
      name: subsidiary.name,
      jurisdiction: subsidiary.jurisdiction_raw || subsidiary.jurisdiction_iso || "Unknown",
      type: subsidiary.type,
      // Add all the company fields that we show for public companies
      cik: subsidiary.identity?.primaryCIK,
      identity: subsidiary.identity,
      aliases: subsidiary.aliases,
      updatedAt: subsidiary.updated_at,
      updatedBy: "system", // Default value
    },
    parentEdge: parentEdge ? {
      ownership_percent: parentEdge.ownership_percent,
      parentCompany: parentEdge.parentCompany,
    } : null,
    isLoading 
  };
};

// Fetch audit trail for a company (limited to recent records for performance)
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
              limit: 50, // Limit to 50 most recent audit records for performance
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