import { useState, memo, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import { useAllCompanies } from "../../db/queries";
import { FilterDropdown } from "./FilterDropdown";
import { FilterChips } from "./FilterChips";
import { getAllCleanCategories, getAllOwnerOrgs, getAllEntityTypes, getCleanCategory } from "financial-graph-shared";

interface CompanyListProps {
  onSelectNode: (id: string) => void;
  showSP500Only: boolean;
  onFilterChange: (showSP500Only: boolean) => void;
}

export const CompanyList = memo(function CompanyList({ onSelectNode, showSP500Only, onFilterChange }: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOwnerOrgs, setSelectedOwnerOrgs] = useState<string[]>([]);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  
  const { companies: allCompanies, isLoading } = useAllCompanies();

  // Get filter options
  const categoryOptions = useMemo(() => getAllCleanCategories(), []);
  const ownerOrgOptions = useMemo(() => getAllOwnerOrgs(), []);
  const entityTypeOptions = useMemo(() => getAllEntityTypes(), []);

  const companies = useMemo(() => {
    let filtered = allCompanies;
    
    // Apply SP500 filter if enabled
    if (showSP500Only) {
      filtered = filtered.filter((c) => c.sp500);
    }
    
    // Apply category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((c) => {
        const cleanCategory = getCleanCategory(c.category);
        return cleanCategory && selectedCategories.includes(cleanCategory);
      });
    }
    
    // Apply owner org filter
    if (selectedOwnerOrgs.length > 0) {
      filtered = filtered.filter((c) => {
        return c.ownerOrg && selectedOwnerOrgs.includes(c.ownerOrg);
      });
    }
    
    // Apply entity type filter
    if (selectedEntityTypes.length > 0) {
      filtered = filtered.filter((c) => {
        return c.entityType && selectedEntityTypes.includes(c.entityType);
      });
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const name = c.name.toLowerCase();
        const ticker = c.ticker?.toLowerCase() ?? "";
        return name.includes(query) || ticker.includes(query);
      });
    }
    
    return filtered;
  }, [allCompanies, searchQuery, showSP500Only, selectedCategories, selectedOwnerOrgs, selectedEntityTypes]);

  const handleClearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedOwnerOrgs([]);
    setSelectedEntityTypes([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Search */}
      <div style={{ padding: "16px" }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
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
            placeholder={showSP500Only ? "Search S&P 500 companies..." : "Search public companies..."}
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
            onClick={() => onFilterChange(!showSP500Only)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: showSP500Only ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.03)",
              color: showSP500Only ? "rgba(99, 102, 241, 0.9)" : "rgba(255,255,255,0.6)",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!showSP500Only) {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "rgba(255,255,255,0.8)";
              }
            }}
            onMouseLeave={(e) => {
              if (!showSP500Only) {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              }
            }}
          >
            <Filter size={12} />
            {showSP500Only ? "S&P 500" : "All Public"}
          </button>

          <FilterDropdown
            label="Category"
            options={categoryOptions}
            selectedValues={selectedCategories}
            onChange={setSelectedCategories}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <FilterDropdown
            label="Owner Org"
            options={ownerOrgOptions}
            selectedValues={selectedOwnerOrgs}
            onChange={setSelectedOwnerOrgs}
          />

          <FilterDropdown
            label="Entity Type"
            options={entityTypeOptions}
            selectedValues={selectedEntityTypes}
            onChange={setSelectedEntityTypes}
          />
        </div>
      </div>

      {/* Active Filter Chips */}
      <FilterChips
        filters={{
          categories: selectedCategories,
          ownerOrgs: selectedOwnerOrgs,
          entityTypes: selectedEntityTypes,
        }}
        onRemoveCategory={(value) => setSelectedCategories(selectedCategories.filter((v) => v !== value))}
        onRemoveOwnerOrg={(value) => setSelectedOwnerOrgs(selectedOwnerOrgs.filter((v) => v !== value))}
        onRemoveEntityType={(value) => setSelectedEntityTypes(selectedEntityTypes.filter((v) => v !== value))}
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
          {showSP500Only ? "S&P 500" : "Companies"}
        </span>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.25)",
          }}
        >
          {isLoading ? "..." : companies.length.toLocaleString()}
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "120px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                border: "2px solid rgba(99, 102, 241, 0.2)",
                borderTopColor: "#818cf8",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
        ) : companies.length === 0 ? (
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
                  onClick={() => onSelectNode(company.id)}
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
                      backgroundColor: company.sp500 ? "#34d399" : company.cik ? "#60a5fa" : "rgba(255,255,255,0.2)",
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
