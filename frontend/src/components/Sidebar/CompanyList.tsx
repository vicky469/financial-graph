import { useState, memo, useMemo } from "react";
import { useAllCompanies } from "../../db/queries";

interface CompanyListProps {
  onSelectNode: (id: string) => void;
}

export const CompanyList = memo(function CompanyList({ onSelectNode }: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Load all companies (minimal data), do client-side search
  const { companies: allCompanies, isLoading } = useAllCompanies();

  console.log("CompanyList debug:", {
    isLoading,
    allCompaniesLength: allCompanies.length,
    searchQuery,
    sampleCompanies: allCompanies.slice(0, 3),
  });

  // Client-side filtering by name or ticker
  const companies = useMemo(() => {
    if (!searchQuery.trim()) return allCompanies;

    const query = searchQuery.toLowerCase();
    const filtered = allCompanies.filter((c) => {
      const name = c.name.toLowerCase();
      const ticker = c.ticker?.toLowerCase() ?? "";
      return name.includes(query) || ticker.includes(query);
    });
    console.log("Filtered companies:", { query, count: filtered.length });
    return filtered;
  }, [allCompanies, searchQuery]);

  return (
    <>
      {/* Search */}
      <div className="px-3 py-3 shrink-0">
        <input
          type="text"
          placeholder="Search companies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-input/50 border border-border/50 rounded-md px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/50"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No companies found</div>
        ) : (
          <div className="pb-4">
            {companies.map((company) => (
              <div
                key={company.id}
                className="group flex items-center gap-2 py-3 px-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-accent/50 hover:border-l-2 hover:border-primary mb-2"
                onClick={() => onSelectNode(company.id)}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    company.cik
                      ? "bg-green-500 group-hover:bg-green-400"
                      : "bg-muted-foreground/40 group-hover:bg-muted-foreground/60"
                  }`}
                />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div
                    className="text-sm font-medium text-foreground/85 group-hover:text-foreground capitalize truncate w-full"
                    title={company.name}
                  >
                    {company.name.toLowerCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
});
