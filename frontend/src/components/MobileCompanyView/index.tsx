import { useState } from "react";
import { Sidebar } from "../Sidebar";
import { DetailPanel } from "../DetailPanel";
import { JurisdictionTreemap } from "../JurisdictionTreemap";
import { SearchModal } from "../SearchModal";
import { useCompanyDetail } from "../../db/queries";
import type { CompanyDetail } from "../../types/domain";

interface MobileCompanyViewProps {
  selectedCompanyId: string;
  selectedSubsidiaryId: string | null;
  onSubsidiaryClick: (subsidiaryId: string | null) => void;
  isLoading: boolean;
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  handleSelectCompany: (nodeId: string | null) => void;
  detailPanelNode: CompanyDetail | { id: string; isSubsidiary: boolean; name?: string } | null;
  isPublic: boolean | undefined;
  parentCompanyId: string | null;
  companyFilters: {
    showSP500Only: boolean;
    categories: string[];
    ownerOrgs: string[];
    entityTypes: string[];
  };
  onFiltersChange: (filters: {
    showSP500Only: boolean;
    categories: string[];
    ownerOrgs: string[];
    entityTypes: string[];
  }) => void;
}

export function MobileCompanyView({
  selectedCompanyId,
  selectedSubsidiaryId,
  onSubsidiaryClick,
  isLoading,
  showSearchModal,
  setShowSearchModal,
  handleSelectCompany,
  detailPanelNode,
  isPublic,
  parentCompanyId,
  companyFilters,
  onFiltersChange,
}: MobileCompanyViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "structure" | "jurisdiction">("overview");

  // Fetch company details to get the full node data for header
  const { company: companyNode } = useCompanyDetail(selectedCompanyId, false);
  const displayNode = companyNode || detailPanelNode;

  const handleBackClick = () => {
    // Go back to main page
    handleSelectCompany(null);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-card" style={{ width: "100%", maxWidth: "100%" }}>
      {/* Back Button */}
      <div className="px-4 pt-3">
        <button
          className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-all rounded-md"
          onClick={handleBackClick}
          style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.6)",
            background: "none",
            border: "none",
            cursor: "pointer",
            minHeight: "36px",
            WebkitTapHighlightColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.9)";
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            e.currentTarget.style.background = "none";
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontWeight: "500" }}>Back</span>
        </button>
      </div>

      {/* Header with company name */}
      <div className="pr-4 pb-3 border-b border-border/30" style={{ paddingLeft: "10px" }}>
        <h2
          style={{
            fontSize: "15px",
            fontWeight: "600",
            color: "rgba(255,255,255,0.95)",
            lineHeight: "1.4",
            wordBreak: "break-word",
          }}
        >
          {displayNode?.name || "Unknown"}
        </h2>
      </div>

      {/* Tab Navigation - styled exactly like DetailPanel tabs */}
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        <div
          style={{
            display: "flex",
            width: "100%",
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: "0",
            borderRadius: "0",
            boxSizing: "border-box",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <button
            onClick={() => setActiveTab("overview")}
            className="cursor-pointer select-none"
            style={{
              flex: 1,
              backgroundColor: activeTab === "overview" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "overview" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
              fontWeight: activeTab === "overview" ? "600" : "400",
              transition: "all 0.2s ease",
              padding: "8px 12px",
              fontSize: "11px",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom: activeTab === "overview" ? "2px solid #3b82f6" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("structure")}
            className="cursor-pointer select-none"
            style={{
              flex: 1,
              backgroundColor: activeTab === "structure" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "structure" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
              fontWeight: activeTab === "structure" ? "600" : "400",
              transition: "all 0.2s ease",
              padding: "8px 12px",
              fontSize: "11px",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom: activeTab === "structure" ? "2px solid #3b82f6" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            Structure
          </button>
          <button
            onClick={() => setActiveTab("jurisdiction")}
            className="cursor-pointer select-none"
            style={{
              flex: 1,
              backgroundColor: activeTab === "jurisdiction" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "jurisdiction" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
              fontWeight: activeTab === "jurisdiction" ? "600" : "400",
              transition: "all 0.2s ease",
              padding: "8px 12px",
              fontSize: "11px",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom: activeTab === "jurisdiction" ? "2px solid #3b82f6" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            Jurisdiction
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden w-full" style={{ width: "100%", maxWidth: "100%" }}>
        {activeTab === "overview" && detailPanelNode && (
          <div 
            className="h-full overflow-y-auto"
            style={{ 
              scrollbarWidth: "thin", 
              scrollbarGutter: "stable",
              WebkitOverflowScrolling: "touch", // Enable smooth scrolling on iOS
              height: "100%",
              maxHeight: "100%"
            }}
          >
            <DetailPanel
              node={detailPanelNode}
              isPublic={isPublic}
              parentCompanyId={parentCompanyId}
              hideTabs={true} // Hide the DetailPanel's internal tabs for mobile
            />
          </div>
        )}

        {activeTab === "structure" && (
          <div 
            className="h-full overflow-y-auto"
            style={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
          >
            <Sidebar
              onSelectCompany={handleSelectCompany}
              selectedCompanyId={selectedCompanyId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={onSubsidiaryClick}
              selectedCompany={companyNode}
              companyFilters={companyFilters}
              onFiltersChange={onFiltersChange}
            />
          </div>
        )}

        {activeTab === "jurisdiction" && (
          <div 
            className="h-full w-full overflow-hidden bg-background"
            style={{ 
              scrollbarWidth: "thin", 
              scrollbarGutter: "stable",
              width: "100%",
              maxWidth: "100%"
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
                Loading Data...
              </div>
            ) : (
              <JurisdictionTreemap
                companyId={selectedCompanyId}
                onSubsidiaryClick={onSubsidiaryClick}
              />
            )}

            {/* Search Modal */}
            <SearchModal
              isOpen={showSearchModal}
              onClose={() => setShowSearchModal(false)}
              onSearchFiling={handleSelectCompany}
            />
          </div>
        )}
      </div>
    </div>
  );
}
