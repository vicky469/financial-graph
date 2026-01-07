import { ArrowLeft, ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Node } from "../../types";
import { useCompanySubsidiaries, useCompanyBrands, useCompanyFilings } from "../../db/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

interface CompanyProps {
  node: Node;
  onBack: () => void;
}

export function Company({ node, onBack }: CompanyProps) {
  const { subsidiaries, isLoading: loadingSubsidiaries } = useCompanySubsidiaries(node.id);
  const { brands, isLoading: loadingBrands } = useCompanyBrands(node.id);
  const { filings, isLoading: loadingFilings } = useCompanyFilings(node.id);

  return (
    <>
      {/* Header with back button */}
      <div className="px-3 py-3 border-b shrink-0 flex items-center gap-3">
        <button
          onClick={onBack}
          title="Back to list"
          className="bg-transparent border-none p-0 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <ArrowLeft size={20} color="white" className="stroke-[1.5]" />
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
            <div className="p-8 text-center text-xs text-muted-foreground">
              No subsidiaries found
            </div>
          ) : (
            <div className="pb-4">
              {subsidiaries.map((subsidiary) => (
                <div
                  key={subsidiary.id}
                  className="flex items-center gap-2 py-2.5 px-2 rounded-md mb-2"
                >
                  <div className="w-4 shrink-0" />
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      subsidiary.cik ? "bg-green-500" : "bg-muted-foreground/40"
                    )}
                  />
                  <span
                    className="text-xs font-medium text-foreground/85 capitalize"
                    title={subsidiary.name}
                  >
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
                    <span
                      className="text-xs font-medium text-foreground/85 capitalize"
                      title={brand.name}
                    >
                      {brand.name.toLowerCase()}
                    </span>
                    {brand.category && (
                      <span className="text-xs text-muted-foreground/60 ml-2">
                        ({brand.category})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SEC Filings Section */}
        <div className="px-3 py-2.5 text-xs text-muted-foreground border-b border-t">
          <span className="font-medium">
            SEC Filings {!loadingFilings && `(${filings.length})`}
          </span>
        </div>
        <div className="px-2 py-2">
          {loadingFilings ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading filings...</p>
            </div>
          ) : filings.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No filings found</div>
          ) : (
            <div className="border border-border/30 rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="text-xs font-semibold text-foreground/80 w-24">
                      Date
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground/80 w-16">
                      Type
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground/80 w-16">
                      Filing
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-foreground/80">
                      Attachments
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filings.map((filing) => (
                    <TableRow key={filing.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs text-foreground/70 align-top py-3">
                        {new Date(filing.filingDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground/90 align-top py-3">
                        {filing.formType}
                      </TableCell>
                      <TableCell className="text-xs align-top py-3">
                        <a
                          href={filing.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          View
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs align-top py-3">
                        {Object.keys(filing.attachments).length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {Object.entries(filing.attachments).map(([name, url]) => (
                              <a
                                key={name}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-400/70 hover:text-blue-300 hover:underline w-fit text-xs"
                              >
                                {name}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
