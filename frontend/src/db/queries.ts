// Shared Query Hooks

import { useMemo, useEffect } from "react";
import { db } from "./client";
import { companyToDetail } from "./adapters";
import { CompanyType, type Company } from "financial-graph-shared";

const CACHE_KEY = "companies_cache";

type CompanyListItem = {
  id: string;
  name: string;
  type: "Company";
  ticker: string | null;
  cik: string | null;
  sp500: boolean;
  category: string | null;
  ownerOrg: string | null;
  entityType: string | null;
};

// Module-level state
let cachedCompanies: CompanyListItem[] | null = null;
let serverFetchDone = false;

// Get cached companies from localStorage (only reads once)
const getCachedCompanies = (): CompanyListItem[] => {
  if (cachedCompanies !== null) return cachedCompanies;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    cachedCompanies = cached ? JSON.parse(cached) : [];
    console.log(`[companies] Loaded ${cachedCompanies!.length} from cache`);
    return cachedCompanies!;
  } catch {
    cachedCompanies = [];
    return [];
  }
};

// Save companies to localStorage
const setCachedCompanies = (companies: CompanyListItem[]) => {
  cachedCompanies = companies;
  serverFetchDone = true;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(companies));
  } catch {}
};

// Load all public companies - instant from cache, fetches from server only once per session
export const useAllCompanies = () => {
  const cached = getCachedCompanies();

  // Only fetch from server if we haven't already this session
  const shouldFetch = !serverFetchDone;

  const { data, isLoading } = db.useQuery(
    shouldFetch
      ? {
          company: {
            $: {
              where: { type: CompanyType.PUBLIC },
            },
          },
        }
      : null
  );

  const freshCompanies = useMemo(() => {
    if (!data?.company) return null;

    return data.company
      .filter((c: any) => c.name && c.name.trim() !== "")
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        type: "Company" as const,
        ticker: c.identity?.tickers?.split(",")[0]?.trim() ?? null,
        cik: c.identity?.primaryCIK ?? null,
        sp500: c.identity?.sp500 === true,
        category: c.identity?.category ?? null,
        ownerOrg: c.identity?.ownerOrg ?? null,
        entityType: c.identity?.entityType ?? null,
      }));
  }, [data?.company]);

  // Update cache when fresh data arrives
  useEffect(() => {
    if (freshCompanies && freshCompanies.length > 0) {
      console.log(`[companies] Loaded ${freshCompanies.length} from server`);
      setCachedCompanies(freshCompanies);
    }
  }, [freshCompanies]);

  const companies = freshCompanies ?? cached;

  return { companies, isLoading: shouldFetch && isLoading && companies.length === 0 };
};

// Load company details - works for both public companies and subsidiaries
// Returns CompanyDetail with all relations
export const useCompanyDetail = (companyId: string | null, isSubsidiary: boolean = false) => {
  const { data, isLoading } = db.useQuery(
    companyId
      ? {
          company: {
            $: {
              where: {
                id: companyId,
              },
            },
            companyInfo: {}, // Fetch company info for detail panel
            // For subsidiaries, also fetch parent relationship
            ...(isSubsidiary && {
              parents: {
                parentCompany: {},
              },
            }),
          },
        }
      : null
  );

  const company = data?.company?.[0];
  
  if (!company) {
    return { 
      company: null, 
      parentEdge: null, 
      isLoading 
    };
  }

  // Convert to CompanyDetail with convenience fields
  const companyDetail = companyToDetail(company as Company & { companyInfo?: unknown });

  // For subsidiaries, extract parent relationship
  const parentEdge = isSubsidiary && company.parents?.[0]
    ? {
        ownership_percent: company.parents[0].ownership_percent,
        parentCompany: company.parents[0].parentCompany,
      }
    : null;

  return { 
    company: companyDetail,
    parentEdge,
    isLoading 
  };
};

// Fetch full hierarchical structure by recursively fetching subsidiary relationships
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
    const subsidiaryEdges = level === 0 ? directSubsidiaries : rootCompany.subsidiaries || [];

    const children = subsidiaryEdges
      .map((edge: any) => {
        const child = edge.subsidiaryCompany;
        if (!child) return null;

        // Recursively build children
        return buildNestedHierarchy(
          {
            ...child,
            subsidiaries: child.subsidiaries || [],
          },
          level + 1
        );
      })
      .filter(Boolean);

    return {
      id: rootCompany.id,
      name: rootCompany.name,
      jurisdiction: rootCompany.jurisdiction_raw || rootCompany.jurisdiction_iso || "Unknown",
      level,
      children,
      ownership_percent: level > 0 ? rootCompany.ownership_percent : null,
    };
  };

  const hierarchyTree = company ? buildNestedHierarchy(company) : null;

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
  return {
    brands: [] as { id: string; name: string; status: string; category?: string }[],
    isLoading: false,
  };
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
