import { useState, memo, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { useAllCompanies } from "../../db/queries";
import { FilterDropdown } from "./FilterDropdown";
import { FilterChips } from "./FilterChips";
import {
  getAllCleanCategories,
  getAllOwnerOrgs,
  getAllEntityTypes,
  getCleanCategory,
} from "financial-graph-shared";
import type { CompanyFilters } from "financial-graph-shared";

interface CompanyListProps {
  onSelectCompany: (id: string) => void;
  companyFilters: CompanyFilters;
  onFiltersChange: (filters: CompanyFilters) => void;
}

export const CompanyList = memo(function CompanyList({
  onSelectCompany,
  companyFilters,
  onFiltersChange,
}: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { companies: allCompanies, isLoading } = useAllCompanies();

  // Get filter options
  const categoryOptions = useMemo(() => getAllCleanCategories(), []);
  const ownerOrgOptions = useMemo(() => getAllOwnerOrgs(), []);
  const entityTypeOptions = useMemo(() => getAllEntityTypes(), []);

  const companies = useMemo(() => {
    let filtered = allCompanies;

    // Apply SP500 filter if enabled
    if (companyFilters.sp500Only) {
      filtered = filtered.filter((c) => c.sp500);
    }

    // Apply category filter
    if (companyFilters.categories.length > 0) {
      filtered = filtered.filter((c) => {
        const cleanCategory = getCleanCategory(c.category);
        return cleanCategory && companyFilters.categories.includes(cleanCategory);
      });
    }

    // Apply owner org filter
    if (companyFilters.ownerOrgs.length > 0) {
      filtered = filtered.filter((c) => {
        return c.ownerOrg && companyFilters.ownerOrgs.includes(c.ownerOrg);
      });
    }

    // Apply entity type filter
    if (companyFilters.entityTypes.length > 0) {
      filtered = filtered.filter((c) => {
        return c.entityType && companyFilters.entityTypes.includes(c.entityType);
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const name = c.name.toLowerCase();
        const hasTickerMatch = c.tickers.some((ticker) =>
          ticker.toLowerCase().includes(query),
        );
        return name.includes(query) || hasTickerMatch;
      });
    }

    return filtered;
  }, [allCompanies, searchQuery, companyFilters]);

  const handleClearAllFilters = () => {
    onFiltersChange({
      ...companyFilters,
      categories: [],
      ownerOrgs: [],
      entityTypes: [],
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Search */}
      <div style={{ padding: "16px" }} className="search-container-wrapper">
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
          className="search-input-container"
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "12px",
              color: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            name="company-search"
            placeholder={
              companyFilters.sp500Only
                ? "Search S&P 500 companies..."
                : "Search public companies..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              padding: "10px 12px 10px 36px",
              fontSize: "13px",
              color: "rgba(255,255,255,0.9)",
              outline: "none",
              transition: "all 0.15s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            }}
            autoFocus
          />
        </div>
      </div>

      {/* Filter Dropdowns */}
      <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <button
            onClick={() =>
              onFiltersChange({ ...companyFilters, sp500Only: !companyFilters.sp500Only })
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: companyFilters.sp500Only
                ? "rgba(99, 102, 241, 0.15)"
                : "rgba(255,255,255,0.03)",
              color: companyFilters.sp500Only ? "rgba(99, 102, 241, 0.9)" : "rgba(255,255,255,0.6)",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!companyFilters.sp500Only) {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "rgba(255,255,255,0.8)";
              }
            }}
            onMouseLeave={(e) => {
              if (!companyFilters.sp500Only) {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              }
            }}
          >
            <Filter size={12} />
            {companyFilters.sp500Only ? "S&P 500" : "All Public"}
          </button>

          <FilterDropdown
            label="Category"
            options={categoryOptions}
            selectedValues={companyFilters.categories}
            onChange={(categories) => onFiltersChange({ ...companyFilters, categories })}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <FilterDropdown
            label="Owner Org"
            options={ownerOrgOptions}
            selectedValues={companyFilters.ownerOrgs}
            onChange={(ownerOrgs) => onFiltersChange({ ...companyFilters, ownerOrgs })}
          />

          <FilterDropdown
            label="Entity Type"
            options={entityTypeOptions}
            selectedValues={companyFilters.entityTypes}
            onChange={(entityTypes) => onFiltersChange({ ...companyFilters, entityTypes })}
          />
        </div>
      </div>

      {/* Active Filter Chips */}
      <FilterChips
        filters={{
          categories: companyFilters.categories,
          ownerOrgs: companyFilters.ownerOrgs,
          entityTypes: companyFilters.entityTypes,
        }}
        onRemoveCategory={(value) =>
          onFiltersChange({
            ...companyFilters,
            categories: companyFilters.categories.filter((v) => v !== value),
          })
        }
        onRemoveOwnerOrg={(value) =>
          onFiltersChange({
            ...companyFilters,
            ownerOrgs: companyFilters.ownerOrgs.filter((v) => v !== value),
          })
        }
        onRemoveEntityType={(value) =>
          onFiltersChange({
            ...companyFilters,
            entityTypes: companyFilters.entityTypes.filter((v) => v !== value),
          })
        }
        onClearAll={handleClearAllFilters}
      />

      {/* Count */}
      <div
        style={{
          padding: "0 16px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {companyFilters.sp500Only ? "S&P 500" : "Companies"}
        </span>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.25)",
          }}
        >
          {isLoading ? "Loading..." : companies.length.toLocaleString()}
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {companies.length === 0 && !isLoading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "120px",
              gap: "8px",
            }}
          >
            <Search size={20} style={{ color: "rgba(255,255,255,0.15)" }} />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
              No companies found
            </span>
          </div>
        ) : (
          <div style={{ paddingBottom: "16px" }}>
            {companies.map((company) => {
              return (
                <button
                  key={company.id}
                  onClick={() => onSelectCompany(company.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid transparent",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      backgroundColor: company.sp500
                        ? "#34d399"
                        : company.cik
                          ? "#60a5fa"
                          : "rgba(255,255,255,0.2)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.75)",
                      textTransform: "capitalize",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: "400",
                    }}
                  >
                    {company.name.toLowerCase()}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
