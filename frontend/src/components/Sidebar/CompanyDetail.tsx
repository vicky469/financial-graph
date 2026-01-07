import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Node } from "../../types";
import { Button } from "../ui/button";
import { useCompanySubsidiaries } from "../../db/queries";

interface CompanyDetailProps {
  node: Node;
  onBack: () => void;
}

export function CompanyDetail({ node, onBack }: CompanyDetailProps) {
  const { subsidiaries, isLoading } = useCompanySubsidiaries(node.id);

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

      {/* Company Structure Section */}
      <div className="px-3 py-2.5 text-xs text-muted-foreground shrink-0">
        <span className="font-medium">
          Company Structure {!isLoading && `(${subsidiaries.length})`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading subsidiaries...</p>
          </div>
        ) : subsidiaries.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No subsidiaries found</div>
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
    </>
  );
}
