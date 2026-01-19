import { useState, memo, useMemo } from "react";
import { Search } from "lucide-react";
import { useAllCompaniesCached } from "../../db/queries";

interface CompanyListProps {
  onSelectNode: (id: string) => void;
}

export const CompanyList = memo(function CompanyList({ onSelectNode }: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { companies: allCompanies, isLoading } = useAllCompaniesCached();

  const companies = useMemo(() => {
    if (!searchQuery.trim()) return allCompanies;
    const query = searchQuery.toLowerCase();
    return allCompanies.filter((c) => {
      const name = c.name.toLowerCase();
      const ticker = c.ticker?.toLowerCase() ?? "";
      return name.includes(query) || ticker.includes(query);
    });
  }, [allCompanies, searchQuery]);

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
            placeholder="Search SP500 companies..."
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
            fontSize: "11px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Companies
        </span>
        <span
          style={{
            fontSize: "11px",
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
            {companies.map((company) => (
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
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
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
                    backgroundColor: company.cik ? "#34d399" : "rgba(255,255,255,0.2)",
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
                  }}
                >
                  {company.name.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
