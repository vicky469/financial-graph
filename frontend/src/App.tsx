import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { JurisdictionTreemap } from "./components/JurisdictionTreemap";
import { SearchModal } from "./components/SearchModal";
import { LandingPage } from "./components/LandingPage";
import { useCompanyDetail } from "./db/queries";
import { db } from "./db/client";
import { InactivityTimeout } from "./components/InactivityTimeout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CompanyType } from "financial-graph-shared";
import type { CompanyDetail } from "./types/domain";

// Desktop Main Content Component
function DesktopMainContent({
  selectedNodeId,
  handleSelectSubsidiary,
}: {
  selectedNodeId: string;
  handleSelectSubsidiary: (subsidiaryId: string | null) => void;
}) {
  const [isTreemapExpanded, setIsTreemapExpanded] = useState(true);

  return (
    <div className="flex-1 overflow-hidden flex flex-col" style={{ width: "100%", maxWidth: "100%" }}>
      {/* Collapseable Treemap Section - Desktop */}
      <div className="hide-on-mobile" style={{ flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 24px",
            cursor: "pointer",
            background: "rgba(255,255,255,0.02)",
            transition: "background 0.15s",
          }}
          onClick={() => setIsTreemapExpanded(!isTreemapExpanded)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
          }}
        >
          <h3
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "rgba(255,255,255,0.7)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Jurisdiction Distribution
          </h3>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isTreemapExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {isTreemapExpanded && (
          <div style={{ background: "hsl(240 6% 6%)" }}>
            <JurisdictionTreemap
              companyId={selectedNodeId}
              onSubsidiaryClick={handleSelectSubsidiary}
            />
          </div>
        )}
      </div>

      {/* Treemap Section - Mobile only */}
      <div className="hide-on-desktop" style={{ flexShrink: 0 }}>
        <JurisdictionTreemap
          companyId={selectedNodeId}
          onSubsidiaryClick={handleSelectSubsidiary}
        />
      </div>
      
      {/* Empty Graph Panel - Desktop */}
      <div className="hide-on-mobile" style={{ 
        flex: 1,
        minHeight: 0,
        width: "100%",
        background: "hsl(240 6% 4%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          color: "rgba(255,255,255,0.3)",
          fontSize: "13px",
          textAlign: "center"
        }}>
          {/* Empty panel - content to be added */}
        </div>
      </div>
    </div>
  );
}

// Mobile Company View Component with Tabs
function MobileCompanyView({
  selectedNodeId,
  selectedSubsidiaryId,
  onSubsidiaryClick,
  isLoading,
  showSearchModal,
  setShowSearchModal,
  handleSelectNode,
  detailPanelNode,
  isPublic,
  parentCompanyId,
  setSelectedSubsidiaryId,
  showSP500Only,
  onFilterChange,
}: {
  selectedNodeId: string;
  selectedSubsidiaryId: string | null;
  onSubsidiaryClick: (subsidiaryId: string | null) => void;
  isLoading: boolean;
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  handleSelectNode: (nodeId: string | null) => void;
  detailPanelNode: CompanyDetail | { id: string; isSubsidiary: boolean; name?: string } | null;
  isPublic: boolean | undefined;
  parentCompanyId: string | null;
  setSelectedSubsidiaryId: (id: string | null) => void;
  showSP500Only: boolean;
  onFilterChange: (show: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "structure" | "jurisdiction">("overview");

  // Fetch company details to get the full node data for header
  const { company: companyNode } = useCompanyDetail(selectedNodeId, false);
  const displayNode = companyNode || detailPanelNode;

  const handleBackClick = () => {
    if (selectedSubsidiaryId) {
      // If viewing a subsidiary, go back to parent company
      setSelectedSubsidiaryId(null);
    } else {
      // If viewing a company, go back to main view
      handleSelectNode(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-card" style={{ width: "100%", maxWidth: "100%" }}>
      {/* Back Button - improved spacing */}
      <div className="flex items-center px-4 py-4 border-b border-border/20 bg-card/50">
        <button 
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-all rounded-md"
          onClick={handleBackClick}
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
            background: "none",
            border: "none",
            cursor: "pointer",
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
            style={{ opacity: 0.8 }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontWeight: "500" }}>Back</span>
        </button>
      </div>

      {/* Header with company name, badges, and updated date - clean mobile styling */}
      <div className="px-4 pb-4 border-b border-border/30" style={{ paddingTop: "5px" }}>
        <div className="flex items-center gap-3 mb-3 justify-end">
          {isLoading && (
            <span className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          )}
        </div>
        <h2
          style={{
            fontSize: "15px",
            fontWeight: "600",
            color: "rgba(255,255,255,0.95)",
            lineHeight: "1.3",
            wordBreak: "break-word",
            padding: "0 8px",
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
              onSelectNode={handleSelectNode}
              selectedNodeId={selectedNodeId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={onSubsidiaryClick}
              showSP500Only={showSP500Only}
              onFilterChange={onFilterChange}
              selectedNode={companyNode}
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
                companyId={selectedNodeId}
                onSubsidiaryClick={onSubsidiaryClick}
              />
            )}

            {/* Search Modal */}
            <SearchModal
              isOpen={showSearchModal}
              onClose={() => setShowSearchModal(false)}
              onSearchFiling={handleSelectNode}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const { companyId } = useParams<{ companyId?: string }>();
  const navigate = useNavigate();

  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSP500Only, setShowSP500Only] = useState(false); // Start with all companies visible

  // Derive selectedNodeId from URL param - no state needed
  const selectedNodeId = companyId || null;

  // Reset subsidiary selection when company changes or navigating to main page
  useEffect(() => {
    setSelectedSubsidiaryId(null);
  }, [selectedNodeId]);

  // Keyboard shortcut for search modal (Cmd+Shift+F or Ctrl+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "F" || e.key === "f" || e.code === "KeyF")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setShowSearchModal(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Update URL when company is selected
  const handleSelectNode = (nodeId: string | null) => {
    if (nodeId) {
      navigate(`/company/${nodeId}`);
    } else {
      navigate("/");
    }
  };

  // Handle subsidiary selection from treemap (just updates detail panel, no URL change)
  const handleSelectSubsidiary = (subsidiaryId: string | null) => {
    setSelectedSubsidiaryId(subsidiaryId);
  };

  const { company: companyNode, isLoading } = useCompanyDetail(selectedNodeId, false);

  // Get the detail panel node - either the selected company or subsidiary
  const detailPanelNode = useMemo(() => {
    if (!selectedNodeId) return null; // No company selected, no detail panel
    
    if (selectedSubsidiaryId) {
      // For subsidiaries, pass a minimal object with isSubsidiary flag
      return { id: selectedSubsidiaryId, isSubsidiary: true };
    }
    
    // Show parent company
    return companyNode || null;
  }, [selectedNodeId, selectedSubsidiaryId, companyNode]);

  const isPublic = companyNode && (companyNode.type === CompanyType.PUBLIC || companyNode.type === CompanyType.ISSUER) ? true : undefined;

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans" style={{ width: "100%", maxWidth: "100%", padding: "0" }}>
      {/* Header */}
      <Header />

      <div className="flex-1 flex overflow-hidden relative min-w-0" key={selectedNodeId} style={{ width: "100%", maxWidth: "100%" }}>
        {/* Mobile: Show company list full width when no company selected, hide when company selected */}
        <div className="hide-on-desktop w-full" style={{ width: "100%", maxWidth: "100%" }}>
          {!selectedNodeId ? (
            <Sidebar
              onSelectNode={handleSelectNode}
              selectedNodeId={selectedNodeId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={handleSelectSubsidiary}
              showSP500Only={showSP500Only}
              onFilterChange={setShowSP500Only}
              selectedNode={companyNode}
            />
          ) : (
            <MobileCompanyView
              selectedNodeId={selectedNodeId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={handleSelectSubsidiary}
              isLoading={isLoading}
              showSearchModal={showSearchModal}
              setShowSearchModal={setShowSearchModal}
              handleSelectNode={handleSelectNode}
              detailPanelNode={detailPanelNode}
              isPublic={isPublic}
              parentCompanyId={selectedSubsidiaryId ? selectedNodeId : null}
              setSelectedSubsidiaryId={setSelectedSubsidiaryId}
              showSP500Only={showSP500Only}
              onFilterChange={setShowSP500Only}
            />
          )}
        </div>

        {/* Desktop: Show sidebar and main content side by side */}
        <div className="hide-on-mobile flex w-full" style={{ width: "100%", maxWidth: "100%" }}>
          <Sidebar
            onSelectNode={handleSelectNode}
            selectedNodeId={selectedNodeId}
            selectedSubsidiaryId={selectedSubsidiaryId}
            onSubsidiaryClick={handleSelectSubsidiary}
            showSP500Only={showSP500Only}
            onFilterChange={setShowSP500Only}
            selectedNode={companyNode}
          />

          <main className="flex-1 min-w-0 relative bg-background flex flex-col overflow-hidden" style={{ width: "100%", maxWidth: "100%" }}>
            {!selectedNodeId ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 gap-3 p-4">
                <div className="w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground/40 mt-2">
                    Press{" "}
                    <kbd className="px-2 py-1 text-xs bg-accent/20 rounded border">⌘ Shift F</kbd> to
                    search by accession number
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
                Loading Data...
              </div>
            ) : (
              <DesktopMainContent
                selectedNodeId={selectedNodeId}
                handleSelectSubsidiary={handleSelectSubsidiary}
              />
            )}

            {/* Search Modal */}
            <SearchModal
              isOpen={showSearchModal}
              onClose={() => setShowSearchModal(false)}
              onSearchFiling={handleSelectNode}
            />
          </main>
        </div>

        {/* Desktop detail panel */}
        {detailPanelNode && (
          <div className="hide-on-mobile">
            <DetailPanel
              node={detailPanelNode}
              isPublic={isPublic}
              parentCompanyId={selectedSubsidiaryId ? selectedNodeId : null}
            />
          </div>
        )}
      </div>


    </div>
  );
}

function AuthenticatedApp() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/company/:companyId" element={<AppContent />} />
    </Routes>
  );
}

function App() {
  const { isLoading, user, error } = db.useAuth();
  
  // Authentication is simply: do we have a user from InstantDB?
  const isAuthenticated = !!user;

  // Toggle body class based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      document.body.classList.remove("landing-mode");
      document.body.classList.add("app-mode");
    } else {
      document.body.classList.remove("app-mode");
      document.body.classList.add("landing-mode");
    }

    return () => {
      document.body.classList.remove("app-mode", "landing-mode");
    };
  }, [isAuthenticated]);

  // Show loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "hsl(240 6% 6%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid rgba(99, 102, 241, 0.2)",
              borderTopColor: "#6366f1",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Loading...</span>
        </div>
      </div>
    );
  }

  // Show error if any
  if (error) {
    console.error("Auth error:", error);
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    // onAuth is called after successful Google login - auth state will
    // automatically update via db.useAuth() hook when user signs in
    return <LandingPage onAuth={() => {}} />;
  }

  // Show main app if authenticated
  return (
    <ErrorBoundary>
      <InactivityTimeout user={user} />
      <AuthenticatedApp />
    </ErrorBoundary>
  );
}

export default App;
