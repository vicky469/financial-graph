import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { JurisdictionTreemap } from "./components/JurisdictionTreemap";
import { SearchModal } from "./components/SearchModal";
import { LandingPage } from "./components/LandingPage";
import { useCompanyGraph } from "./db/queries";
import { db, getSession, clearSession, setSession } from "./db/client";

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
  onSubsidiaryClick: (subsidiaryId: string) => void;
  isLoading: boolean;
  showSearchModal: boolean;
  setShowSearchModal: (show: boolean) => void;
  handleSelectNode: (nodeId: string | null) => void;
  detailPanelNode: { id: string; type: string; name?: string } | null;
  isPublic: boolean;
  parentCompanyId: string | null;
  setSelectedSubsidiaryId: (id: string | null) => void;
  showSP500Only: boolean;
  onFilterChange: (show: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "structure" | "graph">("overview");

  // Fetch company details to get the full node data for header
  const { nodes } = useCompanyGraph(selectedNodeId);
  const displayNode = nodes.find((n) => n.id === selectedNodeId) || detailPanelNode;

  const handleBackClick = () => {
    if (selectedSubsidiaryId) {
      // If viewing a subsidiary, go back to company
      setSelectedSubsidiaryId(null);
    } else {
      // If viewing a company, go back to main view
      handleSelectNode(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">
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
              borderBottom: activeTab === "overview" ? "2px solid #3b82f6" : "2px solid transparent",
              border: "none",
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
              borderBottom: activeTab === "structure" ? "2px solid #3b82f6" : "2px solid transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            Structure
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className="cursor-pointer select-none"
            style={{
              flex: 1,
              backgroundColor: activeTab === "graph" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "graph" ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.5)",
              fontWeight: activeTab === "graph" ? "600" : "400",
              transition: "all 0.2s ease",
              padding: "8px 12px",
              fontSize: "11px",
              borderBottom: activeTab === "graph" ? "2px solid #3b82f6" : "2px solid transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            Graph
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
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
              onClose={() => {}} // Empty function to prevent auto-closing
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
            />
          </div>
        )}

        {activeTab === "graph" && (
          <div 
            className="h-full overflow-hidden bg-background"
            style={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }}
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
  const [showSP500Only, setShowSP500Only] = useState(true); // Persistent filter state at App level

  // Derive selectedNodeId from URL param - no state needed
  const selectedNodeId = companyId || null;

  // Derive selectedGraphNodeId - open company panel by default when company is selected
  const selectedGraphNodeId = useMemo(() => {
    if (selectedSubsidiaryId) return null; // Close company panel when subsidiary is selected
    return selectedNodeId; // Open company panel when company is selected
  }, [selectedNodeId, selectedSubsidiaryId]);

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

  // Handle subsidiary selection from treemap
  const handleSelectSubsidiary = (subsidiaryId: string) => {
    setSelectedSubsidiaryId(subsidiaryId);
  };

  const { nodes, isLoading } = useCompanyGraph(selectedNodeId);

  const selectedGraphNode = useMemo(
    () => nodes.find((n) => n.id === selectedGraphNodeId) ?? null,
    [nodes, selectedGraphNodeId]
  );

  // Get the detail panel node - either the selected company or subsidiary
  const detailPanelNode = useMemo(() => {
    if (selectedSubsidiaryId) {
      // Create a node object for the subsidiary (we'll need to fetch its data)
      return { id: selectedSubsidiaryId, type: "Subsidiary" };
    }
    return selectedGraphNode;
  }, [selectedGraphNode, selectedSubsidiaryId]);

  const isPublic = selectedGraphNode?.cik ? true : false;

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans p-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Header />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative min-w-0" key={selectedNodeId}>
        {/* Mobile: Show company list full width when no company selected, hide when company selected */}
        <div className="hide-on-desktop w-full">
          {!selectedNodeId ? (
            <Sidebar
              onSelectNode={handleSelectNode}
              selectedNodeId={selectedNodeId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={handleSelectSubsidiary}
              showSP500Only={showSP500Only}
              onFilterChange={setShowSP500Only}
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
        <div className="hide-on-mobile flex w-full">
          <Sidebar
            onSelectNode={handleSelectNode}
            selectedNodeId={selectedNodeId}
            selectedSubsidiaryId={selectedSubsidiaryId}
            onSubsidiaryClick={handleSelectSubsidiary}
            showSP500Only={showSP500Only}
            onFilterChange={setShowSP500Only}
          />

          <main className="flex-1 min-w-0 relative bg-background flex flex-col overflow-hidden">
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
              <JurisdictionTreemap
                companyId={selectedNodeId}
                onSubsidiaryClick={handleSelectSubsidiary}
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
              onClose={() => {
                setSelectedSubsidiaryId(null);
              }}
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check session validity and handle automatic logout
  useEffect(() => {
    const checkSession = () => {
      const session = getSession();
      if (session) {
        // Session is valid, user is authenticated
        setIsAuthenticated(true);
      } else {
        // Session expired or doesn't exist
        if (isAuthenticated) {
          // User was authenticated but session expired
          console.log("Session expired, signing out...");
          db.auth.signOut();
        }
        setIsAuthenticated(false);
      }
    };

    // Check session immediately
    checkSession();

    // Set up interval to check session every minute
    const sessionCheckInterval = setInterval(checkSession, 60 * 1000);

    return () => clearInterval(sessionCheckInterval);
  }, [isAuthenticated]);

  // Handle user authentication state changes
  useEffect(() => {
    const handleAuthChange = () => {
      if (user && !isAuthenticated) {
        // User is authenticated, update session
        setSession({
          id: user.id,
          email: user.email || undefined,
          imageURL: user.imageURL || undefined,
        });
        setIsAuthenticated(true);
      } else if (!isLoading && !user && isAuthenticated) {
        // User is not authenticated and not loading
        clearSession();
        setIsAuthenticated(false);
      }
    };

    handleAuthChange();
  }, [user, isLoading, isAuthenticated]);

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
    return <LandingPage onAuth={() => setIsAuthenticated(true)} />;
  }

  // Show main app if authenticated
  return <AuthenticatedApp />;
}

export default App;
