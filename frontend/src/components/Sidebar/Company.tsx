import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Node } from "../../types";
import { useCompanySubsidiaries, useCompanyBrands, useCompanyFilings } from "../../db/queries";
import { useMemo } from "react";

interface CompanyProps {
  node: Node;
  onBack: () => void;
}

export function Company({ node, onBack }: CompanyProps) {
  const { subsidiaries, isLoading: loadingSubsidiaries } = useCompanySubsidiaries(node.id);
  const { brands, isLoading: loadingBrands } = useCompanyBrands(node.id);
  const { filings, isLoading: loadingFilings } = useCompanyFilings(node.id);

  // Group filings by year, then by form type
  const filingsByYear = useMemo(() => {
    const grouped: Record<number, Record<string, typeof filings>> = {};
    filings.forEach((filing) => {
      const year = filing.fiscalYear || new Date(filing.filingDate).getFullYear();
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][filing.formType]) grouped[year][filing.formType] = [];
      grouped[year][filing.formType].push(filing);
    });
    return grouped;
  }, [filings]);

  const years = Object.keys(filingsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <>
      {/* Header with back button */}
      <div className="px-3 py-3 border-b shrink-0 flex items-center gap-3">
        <button
          onClick={onBack}
          className="h-5 w-5 shrink-0 cursor-pointer rounded-full border border-border/50 flex items-center justify-center hover:bg-accent/50 transition-colors"
          title="Back to list"
        >
          <ChevronRight size={17} className="rotate-180" />
        </button>
        <span className="text-sm font-medium truncate capitalize">{node.name.toLowerCase()}</span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Company Structure Section */}
        <div className="px-3 py-2.5 text-xs text-muted-foreground border-b">
          <span className="font-medium">
            Company Structure {!loadingSubsidiaries && `(${subsidiaries.length})`}
          </span>
        </div>
        <div className="px-2 py-1">
          {loadingSubsidiaries ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading subsidiaries...</p>
            </div>
          ) : subsidiaries.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No subsidiaries found</div>
          ) : (
            <div className="pb-4">
              {subsidiaries.map((subsidiary) => (
                <div key={subsidiary.id} className="flex items-center gap-2 py-2.5 px-2 rounded-md mb-2">
                  <div className="w-4 shrink-0" />
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      subsidiary.cik ? "bg-green-500" : "bg-muted-foreground/40"
                    )}
                  />
                  <span className="text-xs font-medium text-foreground/85 capitalize" title={subsidiary.name}>
                    {subsidiary.name.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Brands Section */}
        <div className="px-3 py-2.5 text-xs text-muted-foreground border-b border-t">
          <span className="font-medium">Brands {!loadingBrands && `(${brands.length})`}</span>
        </div>
        <div className="px-2 py-1">
          {loadingBrands ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading brands...</p>
            </div>
          ) : brands.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No brands found</div>
          ) : (
            <div className="pb-4">
              {brands.map((brand) => (
                <div key={brand.id} className="flex items-center gap-2 py-2.5 px-2 rounded-md mb-2">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      brand.status === "active" ? "bg-blue-500" : "bg-muted-foreground/40"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground/85 capitalize" title={brand.name}>
                      {brand.name.toLowerCase()}
                    </span>
                    {brand.category && (
                      <span className="text-xs text-muted-foreground/60 ml-2">({brand.category})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SEC Filings Section */}
        <div className="px-3 py-2.5 text-xs text-muted-foreground border-b border-t">
          <span className="font-medium">SEC Filings {!loadingFilings && `(${filings.length})`}</span>
        </div>
        <div className="px-2 py-1">
          {loadingFilings ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading filings...</p>
            </div>
          ) : filings.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No filings found</div>
          ) : (
            <div className="pb-4">
              {years.map((year) => (
                <div key={year} className="mb-4">
                  <div className="px-2 py-2 text-xs font-semibold text-foreground/70">{year}</div>
                  {Object.entries(filingsByYear[year]).map(([formType, yearFilings]) => (
                    <div key={formType} className="mb-3">
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground/70">{formType}</div>
                      {yearFilings.map((filing) => (
                        <div key={filing.id} className="mb-2">
                          <a
                            href={filing.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-accent/50 transition-colors group"
                          >
                            <ExternalLink className="w-3 h-3 text-muted-foreground/60 group-hover:text-foreground/80 shrink-0" />
                            <span className="text-xs text-foreground/70 group-hover:text-foreground">
                              {new Date(filing.filingDate).toLocaleDateString()}
                            </span>
                          </a>
                          {Object.keys(filing.attachments).length > 0 && (
                            <div className="pl-7 space-y-1">
                              {Object.entries(filing.attachments).map(([name, url]) => (
                                <a
                                  key={name}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-accent/30 transition-colors group text-xs"
                                >
                                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/40 group-hover:text-foreground/60 shrink-0" />
                                  <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground truncate">
                                    {name}
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
