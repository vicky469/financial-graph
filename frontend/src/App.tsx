import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { SearchModal } from "./components/SearchModal";
import { LandingPage } from "./components/LandingPage";
import { DesktopMainContent } from "./components/DesktopMainContent";
import { DynamicUserNotesPanel } from "./components/DesktopMainContent/DynamicUserNotesPanel";
import { MobileCompanyView } from "./components/MobileCompanyView";
import { PreviewBanner } from "./components/PreviewBanner";
import { useCompanyDetail } from "./db/queries";
import { db } from "./db/client";
import { InactivityTimeout } from "./components/InactivityTimeout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CompanyType } from "financial-graph-shared";
import { useDetailPanelWidth, getDetailPanelMaxWidth } from "./hooks/useDetailPanelWidth";

function AppContent() {
  const { companyId, subsidiaryId } = useParams<{ companyId?: string; subsidiaryId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetNoteId = searchParams.get("noteId");

  // Derive selectedCompanyId from URL param - no state needed
  const selectedCompanyId = companyId || null;

  // Derive the actual subsidiary ID, resetting when company changes
  const selectedSubsidiaryId =
    targetNoteId
      ? null
      : subsidiaryId || null;

  const [showSearchModal, setShowSearchModal] = useState(false);

  // Company filters - persisted across navigation
  const [companyFilters, setCompanyFilters] = useState({
    sp500Only: false,
    categories: [] as string[],
    ownerOrgs: [] as string[],
    entityTypes: [] as string[],
  });
  
  const { detailPanelWidth, setDetailPanelWidth, minWidth: DETAIL_PANEL_MIN_WIDTH } = useDetailPanelWidth();
  const [isDetailPanelResizing, setIsDetailPanelResizing] = useState(false);

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

  useEffect(() => {
    if (!isDetailPanelResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxWidth = getDetailPanelMaxWidth(window.innerWidth);
      const rawWidth = window.innerWidth - e.clientX;
      const nextWidth = Math.min(Math.max(rawWidth, DETAIL_PANEL_MIN_WIDTH), maxWidth);
      setDetailPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsDetailPanelResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDetailPanelResizing, DETAIL_PANEL_MIN_WIDTH, setDetailPanelWidth]);

  // Update URL when company is selected
  const handleSelectCompany = (companyId: string | null) => {
    if (companyId) {
      navigate(`/company/${companyId}`);
    } else {
      navigate("/");
    }
  };

  // Handle subsidiary selection from tree/treemap by updating URL.
  const handleSelectSubsidiary = (nextSubsidiaryId: string | null) => {
    if (!selectedCompanyId) return;
    if (nextSubsidiaryId) {
      navigate(`/company/${selectedCompanyId}/subsidary/${nextSubsidiaryId}`);
      return;
    }
    navigate(`/company/${selectedCompanyId}`);
  };

  const handleDetailPanelResizeStart = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDetailPanelResizing(true);
  };

  const { company: companyNode, isLoading } = useCompanyDetail(selectedCompanyId, false);
  const { parentEdge: subsidiaryParentEdge } = useCompanyDetail(
    selectedCompanyId && companyNode?.type === CompanyType.SUBSIDIARY ? selectedCompanyId : null,
    true
  );

  useEffect(() => {
    if (!selectedCompanyId || subsidiaryId) return;
    if (companyNode?.type !== CompanyType.SUBSIDIARY) return;

    const parentId = subsidiaryParentEdge?.parentCompany?.id;
    if (!parentId) return;

    navigate(`/company/${parentId}/subsidary/${selectedCompanyId}`, { replace: true });
  }, [selectedCompanyId, subsidiaryId, companyNode?.type, subsidiaryParentEdge?.parentCompany?.id, navigate]);

  // Get the detail panel node - either the selected company or subsidiary
  const detailPanelNode = useMemo(() => {
    if (!selectedCompanyId) return null; // No company selected, no detail panel

    if (selectedSubsidiaryId) {
      // For subsidiaries, pass a minimal object with isSubsidiary flag
      return { id: selectedSubsidiaryId, isSubsidiary: true };
    }

    // Show parent company
    return companyNode || null;
  }, [selectedCompanyId, selectedSubsidiaryId, companyNode]);

  const isPublic =
    companyNode &&
    (companyNode.type === CompanyType.PUBLIC || companyNode.type === CompanyType.ISSUER)
      ? true
      : undefined;

  return (
    <div
      className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans"
      style={{ width: "100%", maxWidth: "100%", padding: "0" }}
    >
      {/* Preview Banner */}
      <PreviewBanner />

      {/* Header - hidden by default, shows on hover */}
      <div className="header-hover-zone">
        <div className="header-container">
          <Header />
        </div>
      </div>

      <div
        className="flex-1 flex overflow-hidden relative min-w-0"
        key={selectedCompanyId}
        style={{ width: "100%", maxWidth: "100%" }}
      >
        {/* Mobile: Show company list full width when no company selected, hide when company selected */}
        <div className="hide-on-desktop w-full" style={{ width: "100%", maxWidth: "100%" }}>
          {!selectedCompanyId ? (
            <Sidebar
              onSelectCompany={handleSelectCompany}
              selectedCompanyId={selectedCompanyId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={handleSelectSubsidiary}
              selectedCompany={companyNode}
              companyFilters={companyFilters}
              onFiltersChange={setCompanyFilters}
            />
          ) : (
            <MobileCompanyView
              selectedCompanyId={selectedCompanyId}
              selectedSubsidiaryId={selectedSubsidiaryId}
              onSubsidiaryClick={handleSelectSubsidiary}
              isLoading={isLoading}
              showSearchModal={showSearchModal}
              setShowSearchModal={setShowSearchModal}
              handleSelectCompany={handleSelectCompany}
              detailPanelNode={detailPanelNode}
              isPublic={isPublic}
              parentCompanyId={selectedSubsidiaryId ? selectedCompanyId : null}
              companyFilters={companyFilters}
              onFiltersChange={setCompanyFilters}
            />
          )}
        </div>

        {/* Desktop: Show sidebar and main content side by side */}
        <div className="hide-on-mobile flex w-full" style={{ width: "100%", maxWidth: "100%" }}>
          <Sidebar
            onSelectCompany={handleSelectCompany}
            selectedCompanyId={selectedCompanyId}
            selectedSubsidiaryId={selectedSubsidiaryId}
            onSubsidiaryClick={handleSelectSubsidiary}
            selectedCompany={companyNode}
            companyFilters={companyFilters}
            onFiltersChange={setCompanyFilters}
          />

          <main
            className="flex-1 min-w-0 relative bg-background flex flex-col overflow-hidden"
            style={{ width: "100%", maxWidth: "100%" }}
          >
            {!selectedCompanyId ? (
              <DynamicUserNotesPanel />
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
                Loading Data...
              </div>
            ) : (
              <DesktopMainContent
                selectedCompanyId={selectedCompanyId}
                handleSelectSubsidiary={handleSelectSubsidiary}
              />
            )}

            {/* Search Modal */}
            <SearchModal
              isOpen={showSearchModal}
              onClose={() => setShowSearchModal(false)}
              onSearchFiling={handleSelectCompany}
            />
          </main>
        </div>

        {/* Desktop detail panel */}
        {detailPanelNode && (
          <div className="hide-on-mobile relative flex h-full shrink-0">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize detail panel"
              onMouseDown={handleDetailPanelResizeStart}
              className="absolute left-0 top-1/2 cursor-ew-resize"
              style={{
                transform: "translate(-50%, -50%)",
                zIndex: 40,
                width: "24px",
                height: "64px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: "12px",
                  height: "28px",
                  borderRadius: "999px",
                  border: isDetailPanelResizing
                    ? "1px solid rgba(96, 165, 250, 0.7)"
                    : "1px solid rgba(255,255,255,0.2)",
                  background: isDetailPanelResizing
                    ? "rgba(59,130,246,0.35)"
                    : "rgba(20,20,24,0.92)",
                  transition: "all 120ms ease",
                }}
              >
                <div
                  style={{
                    width: "2px",
                    height: "10px",
                    borderRadius: "999px",
                    background: isDetailPanelResizing
                      ? "rgba(191, 219, 254, 0.95)"
                      : "rgba(255,255,255,0.75)",
                  }}
                />
              </div>
            </div>
            <DetailPanel
              node={detailPanelNode}
              isPublic={isPublic}
              parentCompanyId={selectedSubsidiaryId ? selectedCompanyId : null}
              desktopWidth={detailPanelWidth}
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
      <Route path="/company/:companyId/subsidary/:subsidiaryId" element={<AppContent />} />
      <Route path="/company/:companyId/subsidiary/:subsidiaryId" element={<AppContent />} />
    </Routes>
  );
}

function App() {
  const { user, isLoading, error } = db.useAuth();

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

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
